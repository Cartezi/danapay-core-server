const Web3 				= require('web3');
const async 			= require('async');
const compiledCode 		= require('../smart-contract/DanapayToken');
const TransactionLogs	= require('../models/transactionLog');
const profiler			= require('v8-profiler');
const fs 				= require('fs');
var adminAddress 		= process.env.ADMIN_ADDRESS;
var contractAddress		= process.env.CONTRACT_ADDRESS;
var gasLimit			= process.env.HELPER_GASLIMIT;
var gasPrice			= process.env.HELPER_GASPRICE;

var currentGasPrice;
var contractInstance = {
						loading : "false",
						value : "0"
						};
var calls = [];

const web3 = new Web3(new Web3.providers.HttpProvider(process.env.WEB3_ADDRESS));


function logTransaction(_hash, _from, _to, _gas, _value, _data, _gasPrice, _fromPrivateKey, _errorMessage){
	TransactionLogs.createTransactionLog(_hash, _from, _to, _gas, _value, _data, _gasPrice, _fromPrivateKey, _errorMessage, false, function(err){
		if(err)
		{
			console.log("Erreur lors de log de la transaction Ethereum");
			console.log(err);
		}
	});	
}

function _sendSignedTransaction(encodeAbi, fromAddress, fromPrivateKey, toAddress, transferedValue, 
																	confirmationCallback,
																	receiptCallback,
																	waitingCallback,
																	errorCallback)
{
	console.log('Signature et exécution de la transaction');
	var hash;
	web3.eth.accounts.signTransaction({
		from: fromAddress, 
		to:toAddress, 
		gas:gasLimit, 
		value : transferedValue,
		data:encodeAbi,
		gasPrice:gasPrice
	}, fromPrivateKey)
	.then(signed => {
	// console.log("Transaction signed")
	var tran = web3.eth.sendSignedTransaction(signed.rawTransaction);
	// console.log("Transaction sent :"+signed.rawTransaction);

	tran.on('confirmation', (confirmationNumber, receipt) => {
		//console.log('confirmation: ' + confirmationNumber);
		confirmationCallback(confirmationNumber);
	});

	tran.on('transactionHash', _hash => {
		hash = _hash;
		console.log('Hash : '+hash);
	});

	tran.on('receipt', receipt => {
		//console.log('receipt');
		//console.log(receipt);
		if(receipt.status == 1)
			receiptCallback(receipt);
		else {
			errorCallback(new Error("Transaction échouée - statut de la transaction :"+receipt.status));
		}
	});

	tran.on('error', error => {
			if(hash != null) 
				logTransaction(hash, fromAddress, toAddress, gasLimit, transferedValue, encodeAbi, gasPrice, fromPrivateKey, error);
			
			if(error.message.startsWith("Transaction was not mined within 50 blocks"))
			{
				console.log("Transaction non minée au bout de 50 block. Minage encore possible dans quelques blocks...");
				waitingCallback(process.env.EVENT_RETRY);
			}
			else if(error.message.startsWith("Transaction was not mined within750 blocks"))
			{
				console.log("Transaction non minée au bout de 50 block. Minage encore possible dans quelques blocks...");
				waitingCallback(process.env.EVENT_RETRY);
			}
			else if(error.message.startsWith("Transaction was not mined within750 seconds"))
			{
				console.log("Transaction non minée au bout de 50 block. Minage encore possible dans quelques blocks...");
				waitingCallback(process.env.EVENT_RETRY);
			}
			else if(error.message.startsWith("Returned error: replacement transaction underpriced"))
			{
				console.log("Ce compte a déjà une transaction en cours d'execution. Error : replacement transaction underpriced");
				waitingCallback(process.env.EVENT_RETRY);
			}
			else if(error.message.startsWith("Returned error: known transaction:"))
			{
				console.log("Transaction déjà existante.");
				waitingCallback(process.env.EVENT_RETRY);
			}

			else if(error.message.startsWith("Returned error: insufficient funds for gas * price + value"))
			{
				console.log("Le compte éméteur ne dispose pas d'assez d'ether.");
				waitingCallback(process.env.EVENT_RETRY);
			}
			else errorCallback(error);
		});
	});
}

module.exports = {
	sendSignedTransaction : function(encodeAbi, fromAddress, fromPrivateKey, toAddress, transferedValue, 
																	confirmationCallback,
																	receiptCallback,
																	waitingCallback,
																	errorCallback)
	{
		// console.log("Sign transaction");
		// console.log("> From :"+fromAddress);
		// console.log("> To :"+toAddress);
		// console.log("> Privat key :"+fromPrivateKey);
		// console.log("> ABI :"+encodeAbi);

		var hash;

		console.log("Vérification de l'existence de la transaction");
		TransactionLogs.getTransactionLogBySignature(fromAddress, toAddress, gasLimit, transferedValue, encodeAbi, gasPrice, fromPrivateKey, false, function(err, _transationLog){
			if(err)
			{
				console.log("Erreur lors de l'accès au log des transactions Ethereum");
				console.log(err);
				_sendSignedTransaction(encodeAbi, fromAddress, fromPrivateKey, toAddress, transferedValue, confirmationCallback, receiptCallback, waitingCallback, errorCallback);
			}
			else if(_transationLog == null) {
				console.log("Transaction introuvable");
				_sendSignedTransaction(encodeAbi, fromAddress, fromPrivateKey, toAddress, transferedValue, confirmationCallback, receiptCallback, waitingCallback, errorCallback);
			}
			else {
				//Redo transaction
				console.log("Récupération de la transaction depuis Ethereum");
				if(_transationLog.transactionStatus == false)
				{
					console.log("Hash :"+_transationLog.hash);
					web3.eth.getTransactionReceipt(_transationLog.hash).then(function(receipt){
						if(receipt == null)
						{
							waitingCallback(process.env.EVENT_RETRY);
						}
						else if(receipt.status == 0 ){
							console.log("Transaction au par avant échouée - rejeu de la transaction");
							_sendSignedTransaction(encodeAbi, fromAddress, fromPrivateKey, toAddress, transferedValue, confirmationCallback, receiptCallback, waitingCallback, errorCallback);
						}
						else {
							console.log("Transaction réussie");
							TransactionLogs.updateTransactionLogStatus(_transationLog.hash, true, function(err){
								if(err)
								{
									console.log("Erreur lors de la mise à à jour du statut du log de la transaction Ethereum");
									console.log(err);
								}
							});
							receiptCallback(receipt);
							return true;
						}
					});
				}
			}
	
		});		
			
	},

	printEnv : function()
	{
		console.log("ENV :"+process.env.ENV);
		console.log("MONGO_URL :"+process.env.MONGO_URL);
		console.log("ADMIN_ADDRESS :"+process.env.ADMIN_ADDRESS);
		console.log("WEB3_ADDRESS :"+process.env.WEB3_ADDRESS);
		console.log("ADMIN_PRIVATEKEY :"+process.env.ADMIN_PRIVATEKEY);
		console.log("CONTRACT_ADDRESS :"+process.env.CONTRACT_ADDRESS);
		console.log("HELPER_GASLIMIT :"+process.env.HELPER_GASLIMIT);
		console.log("HELPER_GASPRICE :"+process.env.HELPER_GASPRICE);
	}, 

	takeSnapshot : function(index)
	{
		var snapshot = profiler.takeSnapshot();
		snapshot.export(function(error, result){
			fs.writeFileSync('../heap/napaycore'+index+'.heapsnapshot', result); 
			snapshot.delete();
		});
	}

}


