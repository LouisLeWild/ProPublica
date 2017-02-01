var fs = require('fs'),
https = require('https'),
apikey = fs.readFileSync('./public/apikey', 'utf8'),
defaultSession = 115;
//console.log(defaultSession)

const events = require('events');
class EventEmitter extends events {};

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
		return ["/congress/v1", session ? session : defaultSession, chamber, "bills", type + ".json"].join('/');
	},

	billPath: function(billId, session){
		return ["/congress/v1", session ? session : defaultSession, "bills", billId + ".json"].join('/');
	},

	getPropublicaData: function(path, internalEvent, externalEvent){
		reqConfig = {
			"hostname": "api.propublica.org", 
			"path": path,
			"method": "GET",
			"headers": { "X-API-Key" : apikey }
		};

		var req = https.request(reqConfig, function(res){
			console.log("request rec\'d response", res.statusCode, res.statusMessage, externalEvent);

		var respData = '';
		
		res.on('data', (d) => {
			var buf = Buffer.from(d);
			respData += buf.toString('utf8');			
		  });

		res.on('end', () => {
			var responseObject = JSON.parse(respData);
			my.emitter.emit(internalEvent, responseObject, externalEvent);
			});
		});
		req.end();			
	},

	getBill: function(path, session){
		getPropublicaData(path, 'newactivity', 'incomingbills')
	}

};

my.setEmitter(me);

function newactivityListener(data, event){
	me.emit(event, data, event);
}
me.on('newactivity', newactivityListener);

function newfullbillListener(data, event){
	me.emit(event, data, 'bills');
}
me.on('newfullbill', newfullbillListener);

me.house_introduced = function(session){ my.getPropublicaData(my.recentBillsPath("house", "introduced", session),"newactivity","house_introduced");}
me.house_updated = function(session){ my.getPropublicaData(my.recentBillsPath("house", "updated", session),"newactivity","house_updated");}
me.house_passed = function(session){ my.getPropublicaData(my.recentBillsPath("house", "passed", session),"newactivity","house_passed");}
me.house_major = function(session){ my.getPropublicaData(my.recentBillsPath("house", "major", session),"newactivity","house_major");}
me.senate_introduced = function(session){ my.getPropublicaData(my.recentBillsPath("senate", "introduced", session),"newactivity","senate_introduced");}
me.senate_updated = function(session){ my.getPropublicaData(my.recentBillsPath("senate", "updated", session),"newactivity","senate_updated");}
me.senate_passed = function(session){ my.getPropublicaData(my.recentBillsPath("senate", "passed", session),"newactivity","senate_passed");}
me.senate_major = function(session){ my.getPropublicaData(my.recentBillsPath("senate", "major", session),"newactivity","senate_major");}

me.getFullBill = function(billId, session){ my.getPropublicaData(my.billPath(billId, session), "newfullbill", "bills")}

module.exports = me;
