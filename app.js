#!/usr/bin/node

const loadtest = require('loadtest')
const { Pool } = require('pg')
const fs = require('fs')

if (! fs.existsSync('./config/default.json5')) {
    console.error('config/default.json5 must exist. Look at config/example.json5')
    process.exit()
}

const config = require('config')

if (! (config.has('thissitename') && config.get('thissitename').length > 0)) {
    console.log('You must define thissitename in the config file')
    process.exit()
}
var thissitename = config.get('thissitename')

if (! (config.has('endpoints') && config.get('endpoints').length > 0)) {
    console.log('You must define an endpoint in the config file')
    process.exit()
}

if (! (config.has('websites') && config.get('websites').length > 0)) {
    console.log('You must define at least one website in the config file')
    process.exit()
}

// if thissitename is the special value of 'auto', try to figure it out
if ( thissitename == 'auto' ) {
    var tmphostname = require('child_process').execSync('hostname -d').toString()
    var tmphostnameParts = tmphostname.split('.').reverse()
    tmphostname = tmphostnameParts[1]
    //console.log(`hostname is ${tmphostname}`); process.exit();
    thissitename = tmphostname
    if ( thissitename == undefined ) {
        console.log('Unable to automatically determine hostname. Exiting.')
	process.exit()
    }
}

// connect to the database. For now we only support one connection, pull the first endpoint
// configuration from the config file
var endpoint = config.get('endpoints')[0]

if (endpoint.type != 'postgres') {
    console.log('only postgres endpoints are supported right now')
    process.exit()
}

var debuglogging = false
try {
    debuglogging = (config.get('debuglogging') == true)
} catch(e) { /* throw(e)  */ }

var pool;

function connectToDB(retryOnFailure = true) {

    pool = new Pool({
        user: endpoint.user,
        host: endpoint.host,
        database: endpoint.database,
        password: endpoint.password,
        port: endpoint.port,
        ssl: endpoint.ssl,
        connectionTimeoutMillis: 5000,
	query_timeout: 3000
    })
    
    pool.on('error', function(error) {
        console.log('Lost connection to database: ' + error)
        console.log('Will wait and try to reconnrect')
        setTimeout(connectToDB,5000)
    })
    
    // test our connection
    ;(async function() {
        const client = await pool.connect()
        .then( result => {
            console.log(`Connection to ${endpoint.name} successful!. Will log from "${thissitename}"`)
	    result.on('error', (error) => {
	        console.log(`error on the client: ${error}`)
	    })
            result.release()
        } )
        .catch( e=> {
	    if (retryOnFailure) {
		console.log(`Error connecting to ${endpoint.name}! ${e}`)
		console.log(`Will wait and retry`)
                setTimeout(connectToDB,5000)
	    }
	    else {
	        console.error(`Error connecting to ${endpoint.name}! ${e}. Will exit. `)
		process.exit()}
	    })
    })()
}

// passing retryOnFailure = false for the first time we connect
connectToDB(false)

// call doMonitor for each website in the config file
config.get('websites').forEach(website => {
    // wait 2 seconds before starting, to allow our container to settle down. Else first read is slow.    
    setTimeout(doMonitor.bind(this,website),2000)
});

function doMonitor(website) {
    var loadtestOptions = {
        url: website.url,
        maxRequests: 1,  // maybe later these will come from the config file
        concurrency: 1
    }

    var testTimestamp = new Date()
    loadtest.loadTest(loadtestOptions, (error,testresult) => {
        if (error || testresult.totalErrors) {
            console.error(`Got an error testing ${website.name}: ${error}. Will wait and retry.`);
            setTimeout(doMonitor.bind(this,website),5000)
            return;
        }

        var meanLatencyMs = parseInt(testresult.meanLatencyMs)

        if (debuglogging) console.log(`Tested ${website.name} in ${meanLatencyMs}`) 

        sendData(website, testTimestamp, meanLatencyMs)
    })
}

async function sendData(website, testTimestamp, meanLatencyMs) {
    const query = `
    INSERT INTO websitetests (timestamp, url, fromlocation, meanlatencyms)
    VALUES ($1, $2, $3, $4 );
    `

    await pool.query(query,[testTimestamp, website.url, thissitename, meanLatencyMs])
    .then( ()=> {
        if (debuglogging) console.log(`${meanLatencyMs} for ${website.name} has been sent.`)
        // wait a second then continue
        setTimeout(doMonitor.bind(this,website),1000)
        //client.end
    })
    .catch( (error) => {
        console.log(`Lost connection to database: ${error}. Will wait and try again.`)
        setTimeout(doMonitor.bind(this,website),5000)
    })
}

