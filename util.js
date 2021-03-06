/*jshint esversion: 6 */
var me = {
	getType: function(a){
	  	/*	pass an object, returnes an array of top level properties
	  	*/
	  	var p=[];
	    for(var c in a){
	    	p.push(c);
	    }
	    return p;
	},

	areTypesSame: function (a,b){
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
	},

	simpleGenerator: function*(collection){
		for(var a in collection){
			yield(collection[a]);
		}
	},

	batchGenerator: function*(collection, batchsize){
		var i;
		for(i=1; collection.length - ((i-1)*batchsize) > 0 ; i++){
	  		yield collection.slice((i*batchsize)-batchsize,i*batchsize);
	  	}
	},

	batchThenEachGenerator: function*(collection, batchsize){
		var f = collection.slice(0,batchsize);
		var s = collection.slice(batchsize);

		yield f;
		for(var a in s){
			yield([s[a]]);
		}
	},

	iterator: function*(generator, processor){
		var n;
		while(!(n = generator.next()).done){
			yield processor(n.value);
		}
	},

	promiseArrayProcessor: function(promiser, isAll){
		return function(myArray){
			var p = [],
				i;
			for(i in myArray){
				p.push(promiser(myArray[i]));
			}
			if(isAll) return Promise.all(p);
			return Promise.race(p);
		};
	},

	promiseArrayProcessorAll: function(promiser){
		return me.promiseArrayProcessor(promiser, true);
	},

	promiseArrayProcessorRace: function(promiser){
		return me.promiseArrayProcessor(promiser, false);
	},

	triggerIterator: function(iterator, doThen){

		function next(){
			var n;
			if( (n = (iterator.next())).done ) return;
			n.value.then( function(val){ doThen(val); next();});
			
		}
		next();
	}
},
my = {
	combineGxFxFx: function(f1,f2){
		/*	pass in two objects
			same type defined as having identical top level property names (property order does NOT matter)
		*/
		return function(a,b){
			return f2(f1(a), f1(b));
		};
	}
};

me.areObjectsSameType = my.combineGxFxFx(my.getType, my.areTypesSame);


module.exports = me;