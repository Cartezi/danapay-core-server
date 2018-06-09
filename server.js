
require('dotenv').config();
const express 		= require('express');
const bodyParser 	= require('body-parser');
const request 		= require('request');
const Web3 			= require('web3');
const async 		= require('async');
const eventEmitter 	= require('events');
const io 			= require('socket.io')();
const compiledCode 	= require('./smart-contract/DanapayToken');
const Helper 		= require('./utils/helper');


const app 			= express();
var event 			= new eventEmitter();

var apiPort 		= process.env.PORT;
var adminAddress 	= process.env.ADMIN_ADDRESS;
var adminPrivateKey = process.env.ADMIN_PRIVATEKEY;
var getUserRequest	= process.env.GET_USER_REQ;
var jsonInterface   = compiledCode.abi;
var byteCode        = compiledCode.unlinked_binary;
var contractInstance;
var contractAddress;

const web3 = new Web3(new Web3.providers.HttpProvider(process.env.WEB3_ADDRESS));

request(process.env.GET_ADMIN_PARAMS_REQ, function (err, response, res) {
	if(err || response.statusCode != 200)
	{
		console.log("Unable to retrieve contract address from Admin-Params API");
		console.log(err);
	}
	else if(res == null) {
		console.log("Unable to retrieve contract address from Admin-Params API : null result");
		console.log(err);
	}
	else if(!err && response.statusCode == 200) {
		contractAddress = JSON.parse(response.body).contractAddress;
		contractInstance = new web3.eth.Contract(jsonInterface, contractAddress);
		console.log("Initialisation du contrat : "+ contractAddress);
		//console.log(contractInstance);
	}
});

app.use(bodyParser.json());

//Send ethers to accounts when needed
app.post('/api/sendEther', function (req, resp) {
	resp.header('Access-Control-Allow-Origin', "*");
    var params = req.body;
  	var result = {
		userGettingMessage : "",
		transactionMessageResult : ""
	  }
	
	if(
		params.recipientNum == undefined || 
		params.etherAmount == undefined || 
		params.transactionId == undefined)
	{
		resp.json("Invalid parameters");		
	}
	else{
		console.log("Recupération de l'utilisateur :"+params.recipientNum);
		request(getUserRequest+params.recipientNum, function (err, response, res) {
			if(err || response.statusCode != 200)
			{
				console.log(err);
				result.userGettingMessage = "Unable to find user.";
				resp.json(result);
			}
			else if(res ==null || res == undefined) {
				console.log("Unable to find user. User is null");
				result.userGettingMessage = "Unable to find user.";
				resp.json(result);
			}
			else if(!err && response.statusCode == 200) {
				result.userGettingMessage = "User successfully found by phone number.";
				
				Helper.sendSignedTransaction(
					'',
					adminAddress,
					adminPrivateKey,
					JSON.parse(res).user.ethAccount,
					params.etherAmount,
					function(confirmationNumber){
						console.log("Ether sending confirmation : "+confirmationNumber);
						event.emit('etherSendingConfirmation');
						event.emit(process.env.EVENT_PROCESSING,params.transactionId);
					},
					function(receipt){
						console.log("Ethers envoyés");
						event.emit('adminEtherBalanceChanged');
						event.emit('userEtherBalanceChanged');
						event.emit(process.env.EVENT_SUCCEED,params.transactionId);
						
						// result.transactionMessageResult = process.env.TRANSACTION_STATUS_DONE;
						// resp.json(result);
					},
					function(type){
						console.log("Transaction en cours. Veuillez patienter...");
						event.emit(type,params.transactionId);					
					},
					function(error){
						console.log(error);
						event.emit(process.env.EVENT_ON_ERROR,params.transactionId);
					}
				);
				result.transactionMessageResult = process.env.EVENT_PROCESSING;
				resp.json(result);
			  }
		});
	}
	
});

//Buy token from user
app.post('/api/buyToken', function (req, res) {
	res.header('Access-Control-Allow-Origin', "*");
	var params = req.body;
	var result = {
		userGettingMessage : "",
		transactionMessageResult : ""
	}
	if(
		params.userNum == undefined || 
		params.amount == undefined || 
		params.transactionId == undefined)
	{
		res.json("Invalid parameters");		
	}
	else
	{
		console.log("Recupération de l'utilisateur :"+JSON.stringify(req.body))
		request(getUserRequest+params.userNum, function (err, response, userInfo) {
			if(err)
			{
				//Delete account from blockchain
				console.log("Impossible de se connecter à l'API Users");
				console.log(err);
				result.userGettingMessage = "Unable to find user.";
				res.json(result);
			}
			else if(userInfo ==null || userInfo == undefined) {///A corriger...
				//Delete account from blockchain
				console.log("L'utilisateur recherché n'existe pas : User = null");
				result.userGettingMessage = "Unable to find user.";
				res.json(result);
			}else {
				//console.log('Seller : '+adminAddress);
				//console.log('Buyer : '+user.ethAccount);
				//console.log('Amount : '+params.amount);
				result.userGettingMessage = "User successfully found by phone number.";
				var userAddress = JSON.parse(userInfo).user.ethAccount;
				var userKey	= JSON.parse(userInfo).user.privateKey;
				console.log("Envoi des jetons à "+ userAddress);
	
				contractInstance.methods.transferToSender(params.amount).estimateGas({from: process.env.ADMIN_ADDRESS}, function(error, gasAmount){
					console.log('Gas limit '+gasAmount);
				});
			
				Helper.sendSignedTransaction(
					contractInstance.methods.transferToSender(params.amount).encodeABI(),
					userAddress,
					userKey,
					contractAddress,  
					'',
					function(confirmationNumber){
						console.log("Token transfer confirmation : "+confirmationNumber);
						event.emit('tokenTransferConfirmation');
						event.emit(process.env.EVENT_PROCESSING,params.transactionId);					
					},
					function(receipt){
						console.log("Jetons envoyés");
						event.emit('adminTokenBalanceChanged');	
						event.emit('userTokenBalanceChanged');	
						event.emit(process.env.EVENT_SUCCEED,params.transactionId);
						// result.transactionMessageResult = process.env.TRANSACTION_STATUS_DONE;
						// res.json(result);
					},
					function(type){
						console.log("Transaction en cours. Veuillez patienter...");
						console.log(type)
						event.emit(type,params.transactionId);					
						// result.transactionMessageResult = process.env.TRANSACTION_STATUS_DOING;
						// res.json(result);
					},
					function(error){
						console.log(error);
						event.emit(process.env.EVENT_ON_ERROR,params.transactionId);					
						// result.transactionMessageResult = process.env.TRANSACTION_STATUS_ERROR;
						// res.json(result);
					}
				);
				result.transactionMessageResult = process.env.EVENT_PROCESSING;
				res.json(result);
			}
		  });
	}
	
});

//Sell token to user
app.post('/api/sellToken', function (req, res) {
	res.header('Access-Control-Allow-Origin', "*");
	var params = req.body;
	var result = {
		userGettingMessage : "",
		transactionMessageResult : ""
	}
	
  	console.log("Recupération de l'utilisateur :"+params.userNum);
  	request(getUserRequest+params.userNum, function (err, response, userInfo) {
        if(err)
		{
			//Delete account from blockchain
			console.log(err);
			result.userGettingMessage = "Unable to find user.";
			res.json(result);
		}
		else if(userInfo ==null || userInfo == undefined) {
			//Delete account from blockchain
			console.log("Unable to find user. User is null");
			result.userGettingMessage = "Unable to find user.";
			res.json(result);
		}else {
			console.log('Seller : '+JSON.parse(userInfo).user.ethAccount);
			console.log('Seller key: '+JSON.parse(userInfo).user.privateKey);
			console.log('Buyer : '+adminAddress);
			console.log('Amount : '+params.amount);
			result.userGettingMessage = "User successfully found by phone number.";
			console.log("Envoi des jetons");

			contractInstance.methods.transfer(adminAddress, params.amount).estimateGas({from: process.env.ADMIN_ADDRESS}, function(error, gasAmount){
                console.log('Gas limit '+gasAmount);
			});

			Helper.sendSignedTransaction(
				contractInstance.methods.transfer(adminAddress, params.amount).encodeABI(),
				JSON.parse(userInfo).user.ethAccount,
				JSON.parse(userInfo).user.privateKey,
				contractAddress,  
				'',
				function(confirmationNumber){
					// console.log("Token transfer confirmation : "+confirmationNumber);
					event.emit('tokenTransferConfirmation');
					event.emit(process.env.EVENT_PROCESSING,params.transactionId);
				},
				function(receipt){
					console.log("Jetons envoyés");
					event.emit('adminTokenBalanceChanged');	
					event.emit('userTokenBalanceChanged');	
					event.emit(process.env.EVENT_SUCCEED,params.transactionId);
					// result.transactionMessageResult = process.env.TRANSACTION_STATUS_DONE;
					// res.json(result);
				},
				function(type){
					console.log("Transaction en cours. Veuillez patienter...");
					event.emit(type,params.transactionId);					
					// result.transactionMessageResult = process.env.TRANSACTION_STATUS_DOING;
					// res.json(result);
				},
				function(error){
					console.log(error);
					event.emit(process.env.EVENT_ON_ERROR,params.transactionId);					
					// result.transactionMessageResult = process.env.TRANSACTION_STATUS_ERROR;
					// res.json(result);
				}
			);
			result.transactionMessageResult = process.env.EVENT_PROCESSING;
			res.json(result);
		}
	});
});



//Transfer token from an account to other
app.post('/api/transferToken', function (req, res) {
	res.header('Access-Control-Allow-Origin', "*");
	var params = req.body;
	var result = {
		senderGettingMessage : "",
		recipientGettingMessage : "",
		transactionMessageResult : ""
	}
	console.log('Transfer token')
  	console.log("Recupération de l'utilisateur :"+params.senderNum)
  	request(getUserRequest+params.senderNum, function (err, response, senderInfo) {
		if(err)
		{
			//Delete account from blockchain
			console.log("Unable to find user.");
			result.userGettingMessage = "Unable to find user.";
			res.json(result);
		}
		else if(senderInfo ==null || senderInfo == undefined) {
			//Delete account from blockchain
			console.log("Unable to find user. User is null");
			result.userGettingMessage = "Unable to find user.";
			res.json(result);
		}else {
			result.senderGettingMessage = "Sender successfully found by phone number.";
			console.log("Recupération de l'utilisateur :"+params.recipientNum);
			request(getUserRequest+params.recipientNum, function (err, response, recipientInfo) {
				if(err)
				{
					//Delete account from blockchain
					console.log("Unable to find user.");
					result.userGettingMessage = "Unable to find user.";
					res.json(result);
				}
				if(recipientInfo ==null || recipientInfo == undefined ) {
					//Delete account from blockchain
					console.log("Unable to find user. User is null");
					result.userGettingMessage = "Unable to find user.";
					res.json(result);
				}else {
					//console.log('Seller : '+adminAddress);
					//console.log('Buyer : '+user.ethAccount);
					//console.log('Amount : '+params.amount);
					result.recipientGettingMessage = "Recipient successfully found by phone number.";
					console.log("Envoi des jetons");

					contractInstance.methods.transfer(JSON.parse(recipientInfo).user.ethAccount, params.amount).estimateGas({from: process.env.ADMIN_ADDRESS}, function(error, gasAmount){
						console.log('Gas limit '+gasAmount);
					});
					
					Helper.sendSignedTransaction(
						contractInstance.methods.transfer(JSON.parse(recipientInfo).user.ethAccount, params.amount).encodeABI(),
						JSON.parse(senderInfo).user.ethAccount,
						JSON.parse(senderInfo).user.privateKey,
						contractAddress,  
						'',
						function(confirmationNumber){
							console.log("Token transfer confirmation : "+confirmationNumber);
							event.emit('tokenTransferConfirmation');
							event.emit(process.env.EVENT_PROCESSING,params.transactionId);
						},
						function(receipt){
							event.emit('userTokenBalanceChanged');	
							event.emit(process.env.EVENT_SUCCEED,params.transactionId);
							// result.transactionMessageResult = process.env.TRANSACTION_STATUS_DONE;
							// res.json(result);
						},
						function(type){
							console.log("Transaction en cours. Veuillez patienter...");
							event.emit(type,params.transactionId);					
						},
						function(error){
							console.log(error);
							event.emit(process.env.EVENT_ON_ERROR,params.transactionId);
							// result.transactionMessageResult = process.env.TRANSACTION_STATUS_ERROR;
							// res.json(result);
						}
					);
					result.transactionMessageResult = process.env.EVENT_PROCESSING;
					res.json(result);
				}
		  	});
		}
  	});
});

//Websocket listener
io.on('connection', (client) => {
	console.log('client is connected to websocket');

	event.on("adminEtherBalanceChanged", function()
	{
		client.emit('adminEtherBalanceChanged');	
	});

	event.on("userEtherBalanceChanged", function()
	{
		client.emit('userEtherBalanceChanged');	
	});

	event.on("adminTokenBalanceChanged", function()
	{
		client.emit('adminTokenBalanceChanged');	
	});

	event.on("userTokenBalanceChanged", function()
	{
		client.emit('userTokenBalanceChanged');	
	});

	event.on(process.env.EVENT_PROCESSING, function(transactionId)
	{
		client.emit(process.env.EVENT_PROCESSING, transactionId);	
	});

	event.on(process.env.EVENT_RETRY, function(transactionId)
	{
		client.emit(process.env.EVENT_RETRY, transactionId);	
	});

	event.on(process.env.EVENT_SUCCEED, function(transactionId)
	{
		client.emit(process.env.EVENT_SUCCEED, transactionId);	
	});

	event.on(process.env.EVENT_ON_ERROR, function(transsactionId)
	{
		client.emit(process.env.EVENT_ON_ERROR, transactionId);	
	});

});
		
server = app.listen(apiPort, function () {
	var host = server.address().address;
	var port = server.address().port;
	
	console.log('Danapay Api Core prêt - http://%s:%s', host, port);
	});

wSocket = io.listen(server);

module.exports = app;
