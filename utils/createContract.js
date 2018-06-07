require('dotenv').config();
const Web3 			= require('web3');
const compiledCode 	= require('../../build/contracts/DanapayToken');
const async 		= require('async');
var adminAddress 	= "0xf490f63ad0fd55da2681af773a67a78906459286";
var calls           = [];
jsonInterface       = compiledCode.abi;
byteCode            = compiledCode.unlinked_binary;

var contractInstance;

const web3 = new Web3(new Web3.providers.HttpProvider(process.env.WEB3_ADDRESS));

contract = new web3.eth.Contract(jsonInterface, {data : byteCode, from : adminAddress, gas : 1500000});

calls.push(function(callback) {
    contract
    .deploy({arguments: [100000,"AfricaCoin",2,"AFC"]})
    .send({from: adminAddress, gas: 1500000})
    .then(function(newContractInstance, err){
        if (err)
            return callback(err);
        callback(null, newContractInstance);
    });
});

async.parallel(calls, function(err, newContractInstance) {
    if (err){
        throw err;
        console.log("Erreur d'instanciation du contrat");
    }
    else
        contractInstance = newContractInstance; 
        console.log("Contract créé à l'adresse : "+contractInstance[0]._address);
});

