/*jshint esversion: 6 */
var MongoClient = require("mongodb").MongoClient, 
	ppApi = require("./PropAPIWrap/ProPublicaAPI.js"),
	fs = require("fs"),
	co = require("co"),
	util = require('./util'),

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
							"BILL_COSPONSORS": "billcosponsors",
							"VOTE_DIGESTS": "votedigests",
							"VOTES": "votes"
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
		infoLog(message);
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

	function insertBill(bill, collectionName){
		insertOne(bill, collectionName);
	}

	function insertIncomingBillToProcessingTable(bill){
		insertBill(bill, "incomingbills");
	}

	function insertWholeBill(bill, collectionName){
		insertBill(bill, collectionName);
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
				billUnknown(current.number);
			}
			db.close();
		});
	}

	function billUnknown(billNumber){
		co( function*(){
			var db = yield MongoClient.connect(DB_Connections.ProPublica);
			var col = db.collection(ProPublica_Collections.BILLS);
			var docs = yield col.find({"bill": billNumber}).toArray();
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
			var processor = util.promiseArrayProcessor(ppApi.getFullVotePromise);
			var iterator = util.iterator(batchGen, processor);
			util.triggerIterator(iterator, function(){ console.log("finished a batch of vote digests");});
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
ppApi.on("house_introduced", insertBill);
ppApi.on("house_updated", insertBill);
ppApi.on("house_passed", insertBill);
ppApi.on("house_major", insertBill);
ppApi.on("senate_introduced", insertBill);
ppApi.on("senate_updated", insertBill);
ppApi.on("senate_passed", insertBill);
ppApi.on("senate_major", insertBill);

ppApi.on("house_introduced", insertIncomingBillToProcessingTable);
ppApi.on("house_updated", insertIncomingBillToProcessingTable);
ppApi.on("house_passed", insertIncomingBillToProcessingTable);
ppApi.on("house_major", insertIncomingBillToProcessingTable);
ppApi.on("senate_introduced", insertIncomingBillToProcessingTable);
ppApi.on("senate_updated", insertIncomingBillToProcessingTable);
ppApi.on("senate_passed", insertIncomingBillToProcessingTable);
ppApi.on("senate_major", insertIncomingBillToProcessingTable);

ppApi.on("bill", insertWholeBill);
//ppApi.on("bill", soundOff);
ppApi.on("member", insertMember);
ppApi.on("cosponsors", insertCosponsors);
ppApi.on("votedigest", insertVoteDigest);
ppApi.on("vote", insertVote);

//ransackIncomingForNewBills();
// ransackIncomingForNewMembers();
 //ransackIncomingBillsForCosponsors();
 ransackVotesDigestsForVotes();

// // test calls
// ppApi.house_introduced();
// ppApi.house_updated();
// ppApi.house_passed();
// ppApi.house_major();
// ppApi.senate_introduced();
// ppApi.senate_updated();
// ppApi.senate_passed();
// ppApi.senate_major();


// ppApi.getVotesByMonthAndYear("senate", 1, 2017);
// ppApi.getVotesByMonthAndYear("senate", 2, 2017);