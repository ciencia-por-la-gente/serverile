var express = require('express'),
    routes = require('./routes'),
    user = require('./routes/user'),
    http = require('http'),
    path = require('path'),
    fs = require('fs');

var bodyParser = require('body-parser');

var app = express();

var db;

var cloudant;

var fileToUpload;

var dbCredentials = {
    dbName: 'my_sample_db'
};

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.text());
app.use(express.static(__dirname + '/public2'));


//db initialization
function getDBCredentialsUrl(jsonData) {
    var vcapServices = JSON.parse(jsonData);
    // Pattern match to find the first instance of a Cloudant service in
    // VCAP_SERVICES. If you know your service key, you can access the
    // service credentials directly by using the vcapServices object.
    for (var vcapService in vcapServices) {
        if (vcapService.match(/cloudant/i)) {
            return vcapServices[vcapService][0].credentials.url;
        }
    }
}

function initDBConnection() {
    //When running on Bluemix, this variable will be set to a json object
    //containing all the service credentials of all the bound services
    if (process.env.VCAP_SERVICES) {
        dbCredentials.url = getDBCredentialsUrl(process.env.VCAP_SERVICES);
    } else { //When running locally, the VCAP_SERVICES will not be set

        // When running this app locally you can get your Cloudant credentials
        // from Bluemix (VCAP_SERVICES in "cf env" output or the Environment
        // Variables section for an app in the Bluemix console dashboard).
        // Once you have the credentials, paste them into a file called vcap-local.json.
        // Alternately you could point to a local database here instead of a
        // Bluemix service.
        // url will be in this format: https://username:password@xxxxxxxxx-bluemix.cloudant.com
        dbCredentials.url = getDBCredentialsUrl(fs.readFileSync("vcap-local.json", "utf-8"));
    }

    cloudant = require('cloudant')(dbCredentials.url);

    // check if DB exists if not create
    cloudant.db.create(dbCredentials.dbName, function(err, res) {
        if (err) {
            console.log('Could not create new db: ' + dbCredentials.dbName + ', it might already exist.');
        }
    });

    db = cloudant.use(dbCredentials.dbName);
}

initDBConnection();
//db initialization ends

app.get('/', (req,res) => {
    res.sendFile(path.resolve(__dirname,'public2', 'index.html'));
})

var saveDocument = function(id, file, response, cb) {

    if (id === undefined) {
        // Generated random id
        id = '';
    }

    db.insert({
        file: file,
    }, id, function(err, doc) {
        if (err) {
            console.log(err);
            cb(err)
        } else
            cb(null, response)
    });

}

app.post('/sendConv', (req, res) => {
    let file = req.body;
    console.log(req.body);
    saveDocument(null, req.body, res, function(err, status) {
        if (err) {
            res.sendStatus(500);
            res.end();
        } else {
            analyze(file, (err, result) => {
                if (err) {
                    res.sendStatus(500);
                } else {
                    res.send({score: result})
                }
                res.end();
            })
        }
    });
})

//NLU system
const theList = [
    "addiction",
    "alcoholism",
    "smoking addiction",
    "disease",
    "infertility",
    "disorders",
    "mental disorder",
    "panic and anxiety",
    "sexuality",
    "incest and abuse support",
    "cigars",
    "sex",
    "lottery",
    "gambling",
    "immigration",
    "travel",
    "legal issues",
    "geometry",
    "drug trafficking",
    "human trafficking",
    "kidnapping",
    "torture",
    "smuggling",
    "prostitution",
    "pornography",
    "sex education",
    "marriage",
    "sports",
    "body care",
    "cameras and camcorders",
    "tourist destinations",
    "scholarships",
    "transports",
]

const nluV1 = require('watson-developer-cloud/natural-language-understanding/v1');

const nlu = new nluV1({
    version: '2018-03-16',
    username: '41c3e565-c2b9-4764-9f3a-5e43d7777967',
    password: '62KKgKjIxHLv',
    url: 'https://gateway.watsonplatform.net/natural-language-understanding/api'
})

function analyze(text, cb) {
    let parameters = {
    'text': text,
    'features': {
        'entities': {
        'emotion': true,
        'sentiment': true,
        'limit': 2
        },
        'categories': {
            'society': true,
        },
        'keywords': {
        'emotion': true,
        'sentiment': true,
        'limit': 2
        }
    }
    }

    nlu.analyze(parameters, function(err, response) {
    if (err) {
        console.log('error:', err);
        cb(err)
    }
    else {
        console.log(JSON.stringify(response, null, 2));
        cb(null, processNLUResponse(response));
    }
    });

    function processNLUResponse(response) {
        try {
            return response.categories.map(cat => cat.label).map(label => label.split('/')).reduce((acc, val) => acc.concat(val)).filter(word => theList.includes(word)).length;
        } catch (e) {
            return 0;
        }
    }
}

//end NLU system

http.createServer(app).listen(process.env.PORT || 3000, '0.0.0.0', function() {
    console.log('Express server listening on port ' + app.get('port'));
});