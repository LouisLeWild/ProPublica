var MongoClient = require("mongodb").MongoClient;
var ppApi = require("./PropAPIWrap/ProPublicaAPI.js");
var fs = require("fs");
var co = require("co");



var DB_Connections = {"ProPublica": "mongodb://localhost:27017/ProPublica"};
var ProPublica_Collections = { "HOUSE_INTRODUCED":"house_introduced",
							"HOUSE_UPDATED":"house_updated",
							"HOUSE_PASSED":"house_passed",
							"HOUSE_MAJOR":"house_major",
							"SENATE_INTRODUCED":"senate_introduced",
							"SENATE_UPDATED":"senate_updated",
							"SENATE_PASSED":"senate_passed",
							"SENATE_MAJOR":"senate_major",
							"BILLS": "bills",
							"INCOMING_BILLS": "incomingbills",
							"MEMBERS": "members"
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
		}
	}(0, false);

	function insertBill(bill, collectionName){
		var dbAddress = DB_Connections.ProPublica,
		conn = MongoClient.connect(DB_Connections.ProPublica, function(err, db){
			if(!err){
				db.collection(collectionName).insertOne(bill, function(err, r){
					if(!err){
						db.close();
					}
					else {	//trouble inserting bill
						diskLog("trouble inserting bill into " + collectionName);
						db.close();
					}
				});
			}
			else {	//trouble connecting
				diskLog("cant connect to " + dbAddress + ". Trying to insert bill into " + collectionName + ".");
			}
		});
	}

	function insertIncomingBillsToSpecificTable(bills, collectionName){	// incoming bills are the short 'digest' version of a bill document resulting from a call to one of the 'recent bill' endpoints
		for(var r in bills.results){
			for(var n in bills.results[r].bills){
				var current = bills.results[0].bills[n];
				insertBill(current, collectionName);
			}
		}
	}

	function insertIncomingBillsToProcessingTable(bills){
		insertIncomingBillsToSpecificTable(bills, "incomingbills");

	}

	function insertWholeBill(bill, collectionName){
		insertBill(bill.results[0], collectionName);
	}

	function insertMember(memberResponse, collectionName){
		var dbAddress = DB_Connections.ProPublica,
		con = MongoClient.connect(dbAddress, function(err, db){
			if(!err){
				db.collection(collectionName).insertOne(memberResponse.results[0], function(err, r){
					if(!err){
						db.close();
					}
					else{	//trouble inserting member
						diskLog("cant insert member.");
						db.close();
					}
				})
			}
			else {	//trouble connecting
				diskLog("cant connect to " + dbAddress + ". Trying to insert member.");
			}
		});
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

	function memberUnknown(memberId){
		console.log(memberId);
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

ppApi.on("madeRequest", function(){console.log("madeRequest fired");});
ppApi.on("house_introduced", insertIncomingBillsToSpecificTable);
ppApi.on("house_updated", insertIncomingBillsToSpecificTable);
ppApi.on("house_passed", insertIncomingBillsToSpecificTable);
ppApi.on("house_major", insertIncomingBillsToSpecificTable);
ppApi.on("senate_introduced", insertIncomingBillsToSpecificTable);
ppApi.on("senate_updated", insertIncomingBillsToSpecificTable);
ppApi.on("senate_passed", insertIncomingBillsToSpecificTable);
ppApi.on("senate_major", insertIncomingBillsToSpecificTable);

ppApi.on("house_introduced", insertIncomingBillsToProcessingTable);
ppApi.on("house_updated", insertIncomingBillsToProcessingTable);
ppApi.on("house_passed", insertIncomingBillsToProcessingTable);
ppApi.on("house_major", insertIncomingBillsToProcessingTable);
ppApi.on("senate_introduced", insertIncomingBillsToProcessingTable);
ppApi.on("senate_updated", insertIncomingBillsToProcessingTable);
ppApi.on("senate_passed", insertIncomingBillsToProcessingTable);
ppApi.on("senate_major", insertIncomingBillsToProcessingTable);

ppApi.on("bill", insertWholeBill);
ppApi.on("bill", soundOff);
ppApi.on("members", insertMember);

ransackIncomingForNewBills();
ransackIncomingForNewMembers();

// // test calls
// ppApi.house_introduced();
// ppApi.house_updated();
// ppApi.house_passed();
// ppApi.house_major();
// ppApi.senate_introduced();
// ppApi.senate_updated();
// ppApi.senate_passed();
// ppApi.senate_major();

// ppApi.getFullBill("hr726");
// ppApi.getMember("K000388");

