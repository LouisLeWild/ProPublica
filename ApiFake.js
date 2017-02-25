/*jshint esversion: 6 */
var fs = require('fs');
const EventEmitter = require('events');
class propApi_E extends EventEmitter {}

var propApi = new propApi_E();

	propApi.getRecentBills = function(){
		var myRecentBills = my.getRecentBills();
		for(var n in myRecentBills.results[0].bills){
			var current = myRecentBills.results[0].bills[n];
			this.emit("newBill", current);
		}
	};

var my = {

	getRecentBills: function (){
		var billString = fs.readFileSync('./PropAPIWrap/resp.json');
		return JSON.parse(billString);
	}
};

module.exports = propApi;