/* jshint esversion: 6 */
var MongoClient = require("mongodb").MongoClient, 
	ppApi = require("./PropAPIWrap/ProPublicaAPI.js"),
	fs = require("fs"),
	co = require("co"),
	util = require("./util"),
	sha1 = require("sha1"),

	DB_Connections = {"ProPublica": "mongodb://localhost:27017/ProPublica"},
	ProPublica_Collections = { "HOUSE_INTRODUCED":"house_introduced",
							"HOUSE_UPDATED":"house_updated",
							"HOUSE_PASSED":"house_passed",
							"HOUSE_MAJOR":"house_major",
							"SENATE_INTRODUCED":"senate_introduced",
							"SENATE_UPDATED":"senate_updated",
							"SENATE_PASSED":"senate_passed",
							"SENATE_MAJOR":"senate_major",
							"BILLS": "bills",
							"INCOMING_BILLS": "incomingbills",
							"MEMBERS": "members",
							"BILL_COSPONSORS": "billCosponsors",
							"VOTE_DIGESTS": "votedigests",
							"VOTES": "votes",
							"BILL_ACTIONS": "billActions"
					};
	
	DB_Indexes = { 			"BILLS": {"congress": 1, "bill": 1},
							"MEMBERS": {"member_id": 1},
							"VOTES": { "congress": 1, "session": 1, "chamber": 1, "roll_call": 1 },
							"BILL_ACTIONS": {"number": 1, "sha1": 1}
					};



	var diskLog = function(count, blocked){
		return function(message){
			if(!blocked){
				if(++count < 1000){
					fs.appendFileSync("./errorlog.txt", new Date().toString() + " " + message + "\n", "utf8");
				}
				else {
					fs.appendFileSync("./errorlog.txt", new Date().toString() + " " + message + "\n", "utf8");
					fs.appendFileSync("./errorlog.txt", new Date().toString() + " messages halted due to excessive log activity...\n", "utf8");	
					blocked = true;
					ppApi.halt();
				}
			}
		};
	}(0, false);

	function infoLog(message){
		fs.appendFileSync("./infolog.txt", message + ";\n", "utf8");
	}


	function insertStatusNotOK(message){
		infoLog(new Date().toString() + " " + message);
	}

	function insertOne(obj, collectionName){		//could use this as a generic insert with a few minor mods
		conn = MongoClient.connect(DB_Connections.ProPublica, function(err, db){
			if(!err){
				db.collection(collectionName).insertOne(obj, function(err, r){
					if(!err){
						db.close();
					}
					else {	//trouble inserting bill
						diskLog("can't insert object into " + collectionName + ".");
						db.close();
					}
				});
			}
			else {	//trouble connecting
				diskLog("cant connect to " + dbAddress + ". Trying to insert object into " + collectionName + ".");
			}
		});
	}

	function upsertBill(bill){
		co(function*(){
			var db = yield MongoClient.connect(DB_Connections.ProPublica);
			var col = db.collection(ProPublica_Collections.INCOMING_BILLS);
			var res = yield col.update(DB_Indexes.BILLS, bill, {"upsert": true});
			db.close();
		})
		.then(function(){}, function(err){
			diskLog("trouble upserting " + bill.bill);
		});
	}


	function shaobj(obj){
		return sha1(JSON.stringify(obj));
	}

	function insertIncomingBill(bill, collectionName){
		insertOne(bill, collectionName);
	}

	function insertIncomingBillToProcessingTable(bill, origin){
		insertOne(bill, "incomingbills");
		insertBillDigestMeta(bill, origin);
	}

	function insertBillDigestMeta(bill, origin){
		var obj = {};
		obj.number = bill.number;
		obj.latest_major_action_date = bill.latest_major_action_date;
		obj.sha1 = shaobj(bill);
		obj.origin = origin;
		insertOne(obj, "billActions");
	}

	function insertWholeBill(bill, collectionName){
		upsertBill(bill);
	}

	function insertMember(member, collectionName){
		insertOne(member, collectionName);
	}

	function insertCosponsors(billCosponsors, collectionName){
		insertOne(billCosponsors, collectionName);
	}

	function insertVoteDigest(voteDigest, collectionName){
		insertOne(voteDigest, collectionName);
	}

	function insertVote(vote, collectionName){
		insertOne(vote, collectionName);
	}

	function insertManyBills(bills, collectionName){	//doesn't work ???
		var conn = MongoClient.connect(DB_Connections.ProPublica, function(err, db){
			if(!err){
				db.collection(collectionName).insertMany(bills.results[0].bills, function(err, r){
					if(!err){
						db.close();
					} else { console.log(err); db.close();}
				});
			}
		});		
	}

	function ransackIncomingForNewBills(){
		co(function*(){
			var db = yield MongoClient.connect(DB_Connections.ProPublica);
			var col = db.collection(ProPublica_Collections.INCOMING_BILLS);
			var docs = yield col.find().toArray();
			for(var d in docs){
				var current = docs[d];
		//console.log("current.number:", current.number, "current.lmad:", current.latest_major_action_date);
		console.log(JSON.stringify(current, null, 2));
				billUnknown(current.number, current.latest_major_action_date);
			}
			db.close();
		});
	}

	function billUnknown(billNumber, latestMajorActionDate){
		console.log("billNumber:", billNumber, "latestMajorActionDate:", latestMajorActionDate);
		co( function*(){
			var db = yield MongoClient.connect(DB_Connections.ProPublica);
			var col = db.collection(ProPublica_Collections.BILLS);
			var docs = yield col.find({"bill": billNumber, "latest_major_action_date": latestMajorActionDate}).toArray();
			db.close();
			if(!docs.length){
				ppApi.getFullBill(billNumber);
			}
			db.close();
		});
	}

	function soundOff(object, message){
		console.log("SOUND OFF -", message);
	}

	function ransackIncomingForNewMembers(){
		co(function*(){
			var db = yield MongoClient.connect(DB_Connections.ProPublica);
			var col = db.collection(ProPublica_Collections.INCOMING_BILLS);
			var docs = yield col.find().toArray();
			db.close();
			for(var d in docs){
				var current = docs[d];
				var parts = current.sponsor_uri.split("/");
				var slug = parts[parts.length-1].split(".")[0];
				memberUnknown(slug);
			}
		});
	}

	function ransackIncomingBillsForCosponsors(){
		co(function*(){
			var db = yield MongoClient.connect(DB_Connections.ProPublica);
			var col = db.collection(ProPublica_Collections.INCOMING_BILLS);
			var docs = yield col.find().toArray();
			db.close();
			for(var d in docs){
				cosponsorsUnknown(docs[d].number);
			}
		});
	}

	function cosponsorsUnknown(billId){
		co(function*(){
			var db = yield MongoClient.connect(DB_Connections.ProPublica);
			var col = db.collection(ProPublica_Collections.BILL_COSPONSORS);
			var count = yield col.find({"bill": billId}).count();
			db.close();
			if(count === 0){
				ppApi.getBillCosponsors(billId);
			}
		});
	}

	function memberUnknown(memberId){
		co( function*(){
			var db = yield MongoClient.connect(DB_Connections.ProPublica);
			var col = db.collection(ProPublica_Collections.MEMBERS);
			var count = yield col.find({"member_id": memberId}).count();
			if(count === 0){
				ppApi.getMember(memberId);
			}
			db.close();
		});		
	}

	function ransackVotesDigestsForVotes(){
		co(function*(){
			var uris = [];
			var db = yield MongoClient.connect(DB_Connections.ProPublica);
			var digests = db.collection(ProPublica_Collections.VOTE_DIGESTS);
			var votes = db.collection(ProPublica_Collections.VOTES);
			var allDigests = yield digests.find().toArray();
			for(var v in allDigests){
				var current = allDigests[v];
				var count = yield votes.find({"roll_call": current.roll_call}).count();
				if(count === 0){
					uris.push(current.vote_uri);
				}
			}
			db.close();

			var batchGen = util.batchGenerator(uris, 10);
			var processor = util.promiseArrayProcessorAll(ppApi.getFullVotePromise);
			var iterator = util.iterator(batchGen, processor);
			util.triggerIterator(iterator, function(){ });
		});
	}	

	function insertResponseStatusNotOk(errorData){
		var dbAddress = DB_Connections.ProPublica,
		collectionName = "responsenotok",
		conn = MongoClient.connect(DB_Connections.ProPublica, function(err, db){
			if(!err){
				db.collection(collectionName).insertOne(errorData, function(err, r){
					if(!err){
						db.close();
					}
					else {	//trouble inserting bill
						diskLog("can't insert response error data into " + collectionName);
						db.close();
					}
				});
			}
			else {	//trouble connecting
				diskLog("cant connect to " + dbAddress + ". Trying to insert bill into " + collectionName + ".");
			}
		});		
	}

ppApi.on("madeRequest", function(){console.log("madeRequest fired");});
ppApi.on("responsenotok", insertResponseStatusNotOk);
ppApi.on("requestStatusNotOK", insertStatusNotOK);
ppApi.on("house_introduced", insertIncomingBill);
ppApi.on("house_updated", insertIncomingBill);
ppApi.on("house_passed", insertIncomingBill);
ppApi.on("house_major", insertIncomingBill);
ppApi.on("senate_introduced", insertIncomingBill);
ppApi.on("senate_updated", insertIncomingBill);
ppApi.on("senate_passed", insertIncomingBill);
ppApi.on("senate_major", insertIncomingBill);

ppApi.on("house_introduced", insertIncomingBillToProcessingTable);
ppApi.on("house_updated", insertIncomingBillToProcessingTable);
ppApi.on("house_passed", insertIncomingBillToProcessingTable);
ppApi.on("house_major", insertIncomingBillToProcessingTable);
ppApi.on("senate_introduced", insertIncomingBillToProcessingTable);
ppApi.on("senate_updated", insertIncomingBillToProcessingTable);
ppApi.on("senate_passed", insertIncomingBillToProcessingTable);
ppApi.on("senate_major", insertIncomingBillToProcessingTable);

ppApi.on("bill", upsertBill);
//ppApi.on("bill", soundOff);
ppApi.on("member", insertMember);
ppApi.on("cosponsors", insertCosponsors);
ppApi.on("votedigest", insertVoteDigest);
ppApi.on("vote", insertVote);

// // test calls
ppApi.house_introduced();
ppApi.house_updated();
ppApi.house_passed();
ppApi.house_major();
ppApi.senate_introduced();
ppApi.senate_updated();
ppApi.senate_passed();
ppApi.senate_major();


// ppApi.getVotesByMonthAndYear("senate", 1, 2017);
// ppApi.getVotesByMonthAndYear("senate", 2, 2017);

 //ransackIncomingForNewBills();
 //ransackIncomingForNewMembers();
 //ransackIncomingBillsForCosponsors();
//ransackVotesDigestsForVotes();

/*
		insertBillDigestMeta which is called by insertIncomingBillToProcessingTable which is triggered by all introduced updated passed and major events
		inserts a mini-digest of the bill into the billActions collection. it makes sense to triger the afore mentioned events daily/hourly, examine the mini digest table (billActions) for
		multiple results for the same bill, fetch the whole bill replacing what's already out there (to capture the latest activity) and then leaving 
		only the youngest mini-digest in the processing table

		I need a replace function
		an index on the billActions table ()
			
*/
