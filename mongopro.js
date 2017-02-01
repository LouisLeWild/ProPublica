var MongoClient = require('mongodb').MongoClient;
var co = require('co');

co(function*(){
	var db = yield MongoClient.connect("mongodb://localhost:27017/roast");
	console.log('connected');

	var col = db.collection('tuesday');
	var docs = yield col.find().toArray();
	db.close();
	console.log(docs);
}).catch(function(err){
	console.log(err.stack);
});




