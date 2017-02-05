var MongoClient = require('mongodb').MongoClient;
var co = require('co');


var DB_Connections = {"ProPublica": "mongodb://localhost:27017/ProPublica"};
var ProPublica_Collections = {"BILLS": "bills"};

var collectionNames = { "HOUSE_INTRODUCED":"house_introduced",
						"HOUSE_UPDATED":"house_updated",
						"HOUSE_PASSED":"house_passed",
						//"HOUSE_MAJOR":"house_major",
						"SENATE_INTRODUCED":"senate_introduced",
						"SENATE_UPDATED":"senate_updated",
						"SENATE_PASSED":"senate_passed",
						"BILLS": "bills",
						"MEMBERS": "members"
						//,"SENATE_MAJOR":"senate_major"
					};

  function getType(a){
  	/*	pass an object, returned is an array of top level properties
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
    var d=true;a.sort();b.sort();
    for(var c in a){
    	if(!d){break;}
      d = a[c] === b[c];
    }
    return d;
  }
function combineGxFxFx(f1,f2){
/*	pass in two objects
  	same type defined as having identical top level property names (property order does NOT matter)
*/
	return function(a,b){
    	return f2(f1(a), f1(b));
	}
}
var areObjectsSameType = combineGxFxFx(getType, areTypesSame);
var counter = 0;
var count = 0;

	function reCreateDb(){
		co(function*(){
			var db = yield MongoClient.connect(DB_Connections.ProPublica);
			db.dropDatabase();
			
			var x = yield db.collection("bills").ensureIndex({"bill": 1}, {"unique": true, "dropDups": true});
			var x = yield db.collection("members").ensureIndex({"member_id": 1}, {"unique": true, "dropDups": true});
			
			db.close();
		});
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

////////////reCreateDb();
scanMembersForDupes();
scanBillsForDupes();
//aggregate();


// //compares all objects to prototype and logs when it finds a mismatch
// co(function*(){
// 	var db = yield MongoClient.connect(DB_Connections.ProPublica);
// 	var col = db.collection(collectionNames.HOUSE_UPDATED);
// 	var docs = yield col.find().limit(1).toArray();
// 	var masterType = getType(docs[0]);
// 	console.log(masterType);

// 	for(var c in collectionNames){
// 		var current = collectionNames[c];
// 		console.log(current);
// 		col = db.collection(current);
// 		var docs = yield col.find().toArray();
// 		for(var doc in docs){
// 			counter++;
// 			var currentDoc = docs[doc];
// 			var docType = getType(currentDoc);
// 			if(!areTypesSame(docType, masterType)){
// 				console.log("found erant type in", current);
// 			}
// 		}
// 	}
// 	db.close(); 	
// 	console.log(counter);
// });

// var conn = MongoClient.connect(DB_Connections.ProPublica, function(err, db){
// 	if(!err){
// 		var masterType;
// 		var col = db.collection(collectionNames.HOUSE_UPDATED), typea, typeb;
// 		col.find().limit(1).toArray(function(err, docs){
// 			masterType = getType(docs[0]);
// 			for(var c in collectionNames){
// 				var current = collectionNames[c];
// 				console.log(current);
// 				col = db.collection(current);
// 				col.find().toArray(function(err, docs){
// 					for(var doc in docs){
// 						var currentDoc = docs[doc];
// 						var docType = getType(currentDoc);
// 						if(!areObjectsSameType(docType, masterType)){
// 							console.log("found erant type in ",current);
// 						}
// 					} 
// 				});
// 			}
// 		});
// 	}
// 	//db.close();
// });
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

