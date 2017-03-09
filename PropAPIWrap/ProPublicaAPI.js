/*jshint esversion: 6 */
var fs = require("fs"),
	https = require("https"),
	apikey = fs.readFileSync("./public/apikey", "utf8"),
	defaultSession = 115,
	util = require("../util.js");

const events = require("events");
class EventEmitter extends events {}

var me = new EventEmitter();

var my = {

	emitter: null,

	setEmitter: function(emitter){
		my.emitter = emitter;
	},
	
	recentBillsPath: function(chamber, type, session){
		if(chamber != "house" && chamber != "senate"){
			throw "invalid arg sent to recentBillsPath() chamber must be either 'house' or 'senate', passed was '" + chamber + "'.";
		}
		if(type != "introduced" && type != "updated" && type != "passed" && type != "major"){
			throw "invalid arg set to recentBillsPath() type must be 'indroduced', 'updated', 'passed' or 'major', passed was " + type + ".";
		}
		return ["/congress/v1", session ? session : defaultSession, chamber, "bills", type + ".json"].join("/");
	},

	billPath: function(billId, session){
		return ["/congress/v1", session ? session : defaultSession, "bills", billId + ".json"].join("/");
	},

	memberPath: function(memberId){
		return ["/congress/v1", "members", memberId + ".json"].join('/');
	},

	cosponsorsPath: function(billId, session){
		///congress/v1/{congress}/bills/{bill-id}/cosponsors.json
		return ["/congress/v1", session ? session : defaultSession, "bills", billId, "cosponsors.json"].join("/");
	},

	votesByDatePath: function(chamber, year, month){
		return ["/congress/v1", chamber, "votes", month, year + ".json"].join("/");	
	},

	getPropublicaData: function(path, internalEvent, externalEvent){
		console.log("path:", path);
		if(path.indexOf("http") === 0){ path = my.uriPath(path);}
		reqConfig = {
			"hostname": "api.propublica.org", 
			"path": path,
			"method": "GET",
			"headers": { "X-API-Key" : apikey }
		};

		var req = https.request(reqConfig, function(res){
			console.log("request rec\'d response", res.statusCode, res.statusMessage, externalEvent);
			if(res.statusCode != 200){
				my.emitter.emit("responsenotok", {"timestamp": new Date().toString(), "responseStatus": res.statusCode, "responseMessage": res.statusMessage, "functionName": "getPropublicaData", "argsSent": { "path": path, "internalEvent": internalEvent, "externalEvent": externalEvent}} );
			}

		var respData = "";
		
		res.on("data", (d) => {
			var buf = Buffer.from(d);
			respData += buf.toString("utf8");			
		  });

		res.on("end", () => {
			var responseObject = JSON.parse(respData);
			my.emitter.emit(internalEvent, responseObject, externalEvent);
			});
		});
		req.end();			
	},

	getBill: function(path, session){
		getPropublicaData(path, "newactivity", "incomingbills");
	},

	slug: function(s){
		var out = [];
		for(var l in s){
			if(s[l] != "." && s[l] != " "){ out.push(s[l]); }
		}
		return out.join("");
	},

	uriPath: function(uri){
		return "/" + uri.split("/").slice(3).join("/");
	},

	getPropublicaDataFactory: function(internalEvent, externalEvent){
		return function(path){
			return new Promise(function(resolve, reject){
				var internalEvent = "newfullvote";
				var externalEvent = "vote";
				console.log("patharooni:", path);
				if(path.indexOf("http") === 0){ path = my.uriPath(path);}
				reqConfig = {
					"hostname": "api.propublica.org", 
					"path": path,
					"method": "GET",
					"headers": { "X-API-Key" : apikey }
				};

				var req = https.request(reqConfig, function(res){
					console.log("request rec\'d response", res.statusCode, res.statusMessage, externalEvent);
					if(res.statusCode != 200){
						my.emitter.emit("responsenotok", {"timestamp": new Date().toString(), "responseStatus": res.statusCode, "responseMessage": res.statusMessage, "functionName": "getPropublicaData", "argsSent": { "path": path, "internalEvent": internalEvent, "externalEvent": externalEvent}} );
						reject(0);
					}

				var respData = "";
				
				res.on("data", (d) => {
					var buf = Buffer.from(d);
					respData += buf.toString("utf8");			
				  });

				res.on("end", () => {
					var responseObject = JSON.parse(respData);
					my.emitter.emit(internalEvent, responseObject, externalEvent);
					resolve(1);
					});
				});
				req.end();
			});
		}
	}
};

my.setEmitter(me);

function newactivityListener(data, event){
	if(data.status === "OK"){
		for(var r in data.results){
			for(var n in data.results[r].bills){
				var current = data.results[r].bills[n];
				me.emit(event, current, event); //insertBill(current, collectionName);
			}
		}	
	}
	else{
		me.emit("requestStatusNotOK", "newactivityListener rec'd request status not OK");
	}	
}
function newfullbillListener(data, event){
	if(data.status === "OK"){
		me.emit(event, data.results[0], "bills");	
	}
	else{
		me.emit("requestStatusNotOK", "newfullbillListener rec'd request status not OK");
	}
	
}
function newmemberListener(data, event){
	if(data.status === "OK"){
		me.emit(event, data.results[0], "members");	
	}
	else{
		me.emit("requestStatusNotOK", "newmemberListener rec'd request status not OK");
	}
}
function newcosponsorsListener(data, event){
	if(data.status === "OK"){
		me.emit(event, data.results[0], "billCosponsors");
	}
	else {
		me.emit("requestStatusNotOK", "newcosponsorsListener rec'd request status not OK");
	}
}

function newvotesListener(data, event){
	if(data.status === "OK"){
		var chamber = data.results.chamber,
		year = data.results.year,
		month = data.results.month;
		for(var v in data.results.votes){
			var current = data.results.votes[v];
			current.chamber = chamber; current.year = year; current.month = month;
			me.emit(event, current, "votedigests");
		}
	}
	else {
		me.emit("requestStatusNotOK", "newvotesListener rec'd request status not OK");
	}
}

function newfullvoteListener(data, event){
	if(data.status == "OK"){
		me.emit(event, data.results.votes.vote, "votes");
	}
	else {
		me.emit("requestStatusNotOK", "newfullvotesListener rec'd request status not OK");
	}
}

me.on("newactivity", newactivityListener);
me.on("newfullbill", newfullbillListener);
me.on("newmember", newmemberListener);
me.on("newcosponsors", newcosponsorsListener);
me.on("newvotes", newvotesListener);
me.on("newfullvote", newfullvoteListener);

me.halt = function(){ me.removeAllListeners();};
me.house_introduced = function(session){ my.getPropublicaData(my.recentBillsPath("house", "introduced", session),"newactivity","house_introduced");};
me.house_updated = function(session){ my.getPropublicaData(my.recentBillsPath("house", "updated", session),"newactivity","house_updated");};
me.house_passed = function(session){ my.getPropublicaData(my.recentBillsPath("house", "passed", session),"newactivity","house_passed");};
me.house_major = function(session){ my.getPropublicaData(my.recentBillsPath("house", "major", session),"newactivity","house_major");};
me.senate_introduced = function(session){ my.getPropublicaData(my.recentBillsPath("senate", "introduced", session),"newactivity","senate_introduced");};
me.senate_updated = function(session){ my.getPropublicaData(my.recentBillsPath("senate", "updated", session),"newactivity","senate_updated");};
me.senate_passed = function(session){ my.getPropublicaData(my.recentBillsPath("senate", "passed", session),"newactivity","senate_passed");};
me.senate_major = function(session){ my.getPropublicaData(my.recentBillsPath("senate", "major", session),"newactivity","senate_major");};
me.getMember = function(memberId){ my.getPropublicaData(my.memberPath(memberId), "newmember", "member");};
me.getFullBill = function(billId, session){ console.log(my.billPath(my.slug(billId), session)); my.getPropublicaData(my.billPath(my.slug(billId), session), "newfullbill", "bill");};


me.getBillCosponsors = function(billId, session){ my.getPropublicaData(my.cosponsorsPath(my.slug(billId), session), "newcosponsors", "cosponsors"); };

me.getVotesByMonthAndYear = function(chamber, month, year){ console.log(my.votesByDatePath(chamber, month, year)); 
	my.getPropublicaData(my.votesByDatePath(chamber, month, year), "newvotes", "votedigest" );
	 };

me.getFullVote = function(path){ my.getPropublicaData(path, "newfullvote", "vote");};

me.getFullVotePromise = my.getPropublicaDataFactory("newfullvote", "vote");

module.exports = me;
