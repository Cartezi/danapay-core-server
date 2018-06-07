require('dotenv').config();
var mongoose = require('mongoose');
//mongoose.set('debug',true);

//connect to mongoose
mongoose.connect(process.env.MONGO_URL, { useMongoClient: true }, function(err){
	if(err)
		throw err;
	console.log("connected successfully");
});

//Genre schema
var transactionLogSchema = mongoose.Schema({
	hash : {
		type : String, 
		required : true
    },
	from : {
		type : String, 
		required : true
	},
	to : {
		type : String, 
		required : false
	},
	gas : {
		type : String, 
		required : false
	},
	value : {
		type : String, 
		required : false
	},
	data : {
		type : String, 
		required : false
	},
	gasPrice : {
		type : String, 
		required : false
    }, 
    fromPrivateKey : {
		type : String, 
		required : true
    }, 
    errorMessage : {
        type : String, 
		required : false
    }, 
    transactionStatus : {
        type : Boolean, 
		required : true
    }
})


var TransactionLog = module.exports = mongoose.model('TransactionLog', transactionLogSchema);

//Create user
module.exports.createTransactionLog = function (_hash, _from, _to, _gas, _value, _data, _gasPrice, _fromPrivateKey, _errorMessage, _transactionStatus, callback){
	TransactionLog.create({
		hash : _hash, 
		from : _from, 
		to : _to, 
		gas : _gas,
		value : _value,
		data : _data,
        gasPrice : _gasPrice, 
        fromPrivateKey : _fromPrivateKey, 
        errorMessage : _errorMessage,
        transactionStatus : _transactionStatus
		}, callback);
}

//Get transaction log
module.exports.getTransactionLogByHash = function (_hash, callback){
	TransactionLog.findOne({hash : _hash }, callback);
}

module.exports.getTransactionLogBySignature = function (_from, _to, _gas, _value, _data, _gasPrice, _fromPrivateKey, _transactionStatus, callback){
	TransactionLog.findOne({
		from : _from, 
		to : _to, 
		gas : _gas,
		value : _value,
		data : _data,
        gasPrice : _gasPrice, 
        fromPrivateKey : _fromPrivateKey, 
        transactionStatus : _transactionStatus
		}, callback);
}

//Update transaction log
module.exports.updateTransactionLogStatus = function(_hash, _transactionStatus, callback){
    TransactionLog.findOneAndUpdate(
        {hash : _hash},
        {$set:{transactionStatus:_transactionStatus}},
        callback);
}