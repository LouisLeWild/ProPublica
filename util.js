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
	}
},
my = {
	combineGxFxFx: function(f1,f2){
		/*	pass in two objects
			same type defined as having identical top level property names (property order does NOT matter)
		*/
		return function(a,b){
			return f2(f1(a), f1(b));
		}
	}
};

me.areObjectsSameType = my.combineGxFxFx(my.getType, my.areTypesSame);


module.exports = me;