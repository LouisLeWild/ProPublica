var MongoClient = require('mongodb').MongoClient;
var ppApi = require('./PropAPIWrap/ProPublicaAPI.js');



var DB_Connections = {"ProPublica": "mongodb://localhost:27017/ProPublica"};
var ProPublica_Collections = {"BILLS": "bills"};

	function insertBill(bill, collectionName){
		var conn = MongoClient.connect(DB_Connections.ProPublica, function(err, db){
			if(!err){
				db.collection(collectionName).insertOne(bill, function(err, r){
					if(!err){
						db.close();
					}
				});
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
		insertIncomingBillsToSpecificTable(bills, 'incomingbills');
	}

	function insertBigBill(bill, collectionName){
		insertBill(bill, collectionName);
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

	function soundOff(object, message){
		console.log("SOUND OFF -", message);
	}

//ppApi.on('house_introduced', insertBills);
ppApi.on('house_introduced', insertIncomingBillsToSpecificTable);
ppApi.on('house_updated', insertIncomingBillsToSpecificTable);
ppApi.on('house_passed', insertIncomingBillsToSpecificTable);
ppApi.on('house_major', insertIncomingBillsToSpecificTable);
ppApi.on('senate_introduced', insertIncomingBillsToSpecificTable);
ppApi.on('senate_updated', insertIncomingBillsToSpecificTable);
ppApi.on('senate_passed', insertIncomingBillsToSpecificTable);
ppApi.on('senate_major', insertIncomingBillsToSpecificTable);

ppApi.on('house_introduced', insertIncomingBillsToProcessingTable);
ppApi.on('house_updated', insertIncomingBillsToProcessingTable);
ppApi.on('house_passed', insertIncomingBillsToProcessingTable);
ppApi.on('house_major', insertIncomingBillsToProcessingTable);
ppApi.on('senate_introduced', insertIncomingBillsToProcessingTable);
ppApi.on('senate_updated', insertIncomingBillsToProcessingTable);
ppApi.on('senate_passed', insertIncomingBillsToProcessingTable);
ppApi.on('senate_major', insertIncomingBillsToProcessingTable);

ppApi.on('bills', soundOff);
ppApi.on('madeRequest', function(){console.log('madeRequest fired');});
ppApi.on('bills', insertBigBill)

// ppApi.house_introduced();
// ppApi.house_updated();
// ppApi.house_passed();
// ppApi.house_major();
// ppApi.senate_introduced();
// ppApi.senate_updated();
// ppApi.senate_passed();
// ppApi.senate_major();
ppApi.getFullBill("hr726");



	// conn_roast.then(function(db){
	// 	var col = db.collection('tuesday');
	// 	var docs = col.find({"day": "tuesday", "hours": {$gte:6}}, {_id:0}).toArray(function(err, docs){
	// 		console.log(docs);
	// 		db.close();
	// 	});
	// });

	
	
	
	

