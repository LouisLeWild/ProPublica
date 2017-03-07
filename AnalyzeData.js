/*jshint esversion: 6 */
var MongoClient = require('mongodb').MongoClient;
var co = require('co');
var fs = require('fs');
var util = require('util'); 

var DB_Connections = {"ProPublica": "mongodb://localhost:27017/ProPublica"};
var ProPublica_Collections = {"BILLS": "bills"};

var collectionNames = { "HOUSE_INTRODUCED":"house_introduced",
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

//var areObjectsSameType = combineGxFxFx(util.getType, util.areTypesSame);	//moved to util
var counter = 0;
var count = 0;

	function reCreateDb(){
		co(function*(){
			var db = yield MongoClient.connect(DB_Connections.ProPublica);
			db.dropDatabase();
			
		var x = yield db.collection("bills").ensureIndex({"congress": 1, "bill": 1}, {"unique": true, "dropDups": true});
		x = yield db.collection("members").ensureIndex({"member_id": 1}, {"unique": true, "dropDups": true});
		x = yield db.collection("votes").ensureIndex({ "congress": 1, "session": 1, "chamber": 1, "roll_call": 1 }, {"unique": true, "dropDups": true});
		x = yield db.collection("billActions").ensureIndex( {"number": 1, "sha1": 1} , {"unique": true, "dropDups": true} );

			db.close();
		});
	}

	function clearIncomingBillCollections(){
		co(function*(){
			var db = yield MongoClient.connect(DB_Connections.ProPublica);
			// yield db.collection(collectionNames.HOUSE_INTRODUCED).drop();
			// yield db.collection(collectionNames.HOUSE_UPDATED).drop();
			// yield db.collection(collectionNames.HOUSE_PASSED).drop();
			// yield db.collection(collectionNames.HOUSE_MAJOR).drop();
			// yield db.collection(collectionNames.SENATE_INTRODUCED).drop();
			// yield db.collection(collectionNames.SENATE_UPDATED).drop();
			// yield db.collection(collectionNames.SENATE_PASSED).drop();
			// yield db.collection(collectionNames.SENATE_MAJOR).drop();
			//yield db.collection(collectionNames.INCOMING_BILLS).drop();
			db.close();
		}).then(function(){},function(err){ console.log("err ... ", err); });
	}

	function scanMembersForDupes(collectionName, strategy){
		console.log('scanning for dupes...');
		co(function*(){
			var db = yield MongoClient.connect(DB_Connections.ProPublica);
			var col = db.collection(collectionNames.MEMBERS);
			var docs = yield col.find().toArray();
			console.log("docs.length", docs.length);
			for(var d in docs){
				
				var current = docs[d];
				var memcount = yield col.find({"member_id": current.member_id}).count();
				if(memcount > 1){
					console.log("\n<<<<<<<<<<<<<<<");
					console.log("found duplicate", current.member_id, memcount);
					console.log(">>>>>>>>>>>>>>>");
				}
			}
			db.close();
			console.log('done.');
		});
	}

	function scanBillsForDupes(collectionName, strategy){
		console.log('scanning for dupes...');
		co(function*(){
			var db = yield MongoClient.connect(DB_Connections.ProPublica);
			var col = db.collection(collectionNames.BILLS);
			var docs = yield col.find().toArray();
			console.log("docs.length", docs.length);
			for(var d in docs){
				
				var current = docs[d];
				var memcount = yield col.find({"bill": current.bill}).count();
				if(memcount > 1){
					console.log("\n<<<<<<<<<<<<<<<");
					console.log("found duplicate", current.bill, memcount);
					console.log(">>>>>>>>>>>>>>>");
				}
			}
			db.close();
			console.log('done.');
		});
	}

	function aggregate(){
		console.log('aggergating...');
		co(function*(){
			var db = yield MongoClient.connect(DB_Connections.ProPublica);
			var col = db.collection(collectionNames.MEMBERS);
			var count = yield col.find({"member_id": "L000577"}).count();	//M000355:9, I00024:2, L000577:2, E000295:4
			db.close();
			console.log(count);
		});
	}

	function queryToFile(fileName){
		console.log("querying...");
		var filePath = "./PropAPIWrap/work/" + fileName;
		co( function*(){
			var db = yield MongoClient.connect(DB_Connections.ProPublica);
			var col = db.collection(collectionNames.VOTES);
			var result = yield col.find().limit(1).toArray();
			
			db.close();
			fs.writeFileSync(filePath, JSON.stringify(result, null, 2), "utf8");
		});
	}


//////////reCreateDb();
//scanMembersForDupes();
//scanBillsForDupes();
//aggregate();

//queryToFile("/vote.json");

//////////clearIncomingBillCollections();

//compares all objects to prototype and logs when it finds a mismatch

	function getType(a){
	  	/*	pass an object, returnes an array of top level properties
	  	*/
	  	var p=[];
	    for(var c in a){
	    	p.push(c);
	    }
	    return p;
	}

	function areTypesSame(a,b){
		/*	pass two arrays representing top level properties of objects
			returns boolean
		*/  
		if(a.length != b.length){ return false;}
		var d=true;
		a.sort();
		b.sort();
		for(var c in a){
			if(!d){break;}
		  d = a[c] === b[c];
		}
		return d;
	}

	function compareTypesInCollection(collectionName, r1, r2){
		co(function*(){
			var db = yield MongoClient.connect(DB_Connections.ProPublica);
			var col = db.collection(collectionName);
			var doc1 = (yield col.find().skip(r1).limit(1).toArray())[0];
			var doc2 = (yield col.find().skip(r2).limit(1).toArray())[0];
			db.close();

			doc1type = getType(doc1);
			doc2type = getType(doc2);

			// console.log(doc1type);
			// console.log(doc2type);
			console.log(areTypesSame(doc1type, doc2type));
		});
	}

	function countErantTypes(){
		var counter = 0;
		var erant = 0;
		var mt;
		co(function*(){
			var db = yield MongoClient.connect(DB_Connections.ProPublica);
			var col = db.collection(collectionNames.INCOMING_BILLS);
			var docs = yield col.find().limit(1).toArray();
			var masterType = getType(docs[0]);
			console.log(masterType);
			for(var c in collectionNames){
				erant = 0; counter = 0;
				var current = collectionNames[c];
				col = db.collection(current);
				mt = yield col.find().limit(1).toArray();
				masterType = getType(mt[0]);
				docs = yield col.find().toArray();
				for(var doc in docs){
					counter++;
					var currentDoc = docs[doc];
					var docType = getType(currentDoc);
		//console.log(docType);			
					if(!areTypesSame(docType, masterType)){
						//console.log("found erant type in", current);
						erant++;
					}
				}
				console.log(current,erant,counter);
			}
			db.close(); 	
		});		
	}

function findAllTypes(){
	co( function*(){
		var db = yield MongoClient.connect(DB_Connections.ProPublica),
		col, 
		docs
		;
		
		for(var c in collectionNames){
			console.log(collectionNames[c])
			col = db.collection(collectionNames[c]);
			docs = yield col.find().toArray();
			for(var d in docs){
				yield registerType(collectionNames[c], getType(docs[d]));
			}
		}
		db.close();		

	});
}	



function registerType(collectionName, type){
	return co(function*(){
		var known = false,
		knownTypes;

		var db = yield MongoClient.connect(DB_Connections.ProPublica);
		var col = db.collection("types");
		var collectionDocument = (yield col.find({"collectionName": collectionName}).toArray())[0];
		if(collectionDocument){
			console.log("collection document found!!!:", collectionName);
			knownTypes = collectionDocument.types;
			for(var t in knownTypes){
				var current = knownTypes[t];
				if(areTypesSame(type,current)){
					known = true;
				}
			}
		}
		else {
			console.log("no collection document found:", collectionName);
		}
		if(!known){
			if(!collectionDocument){ collectionDocument = { "collectionName": collectionName, "types":[ ] }; };
			collectionDocument.types[collectionDocument.types.length] = type;
			yield col.save(collectionDocument);
		}
		db.close();
	});
}

//countErantTypes()

//compareTypesInCollection(collectionNames.VOTES, 0, 2);

findAllTypes();


// var printType = true;
// var conn = MongoClient.connect(DB_Connections.ProPublica);
// conn.then(function(db){
// 	var masterType;
// 	var col = db.collection(collectionNames.HOUSE_UPDATED);
// 	var result = col.find().limit(1).toArray();
// 	result.then(function(r){
// 		masterType = getType(r[0]);
// 		//console.log(masterType);
// 	});
// 	return {"db": db, "masterType": masterType};
// }).then(function(data){
// 	console.log("here is master type:", data.masterType);
// 	var db = data.db, masterType = data.masterType;
// 	for(var c in collectionNames){
// 		var current = collectionNames[c];
// 		console.log(current);
// 		var col = db.collection(current);
// 		var result = col.find().toArray();
// 		result.then(function(masterType){
// 			return function(res){
// 			var count = 0, currentCollection = current;
// 			for(var doc in res){
// 				var currentDoc = res[doc];
// 				var docType = getType(currentDoc);
// 				if(!areObjectsSameType(docType, masterType)){
// 					if(printType){
// 						console.log("masterType",masterType);
// 						console.log("docType", docType);
// 						printType = false;
// 					}
// 					//console.log("found erant type in ", currentCollection, ++count);
// 				}
// 			}
// 		};}(masterType)
// 		);	// <-- masterType out of scope, teleport it in here.
// 	}
// 	return db;
// }).then(function(db){db.close();});

/*
	mastertype is not being passed along the promise chain as expected ... nested promise is wehre we get masterType
	...how pass it up through the nesting level? ... maybe return an object like {res: result, db: db} ??? and then off of that?
*/

