/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
  Temporary script to translate sql version of trials into json.
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

const fs             = require("fs");
const stream         = require("stream");
const pg             = require("pg");
const QueryStream    = require("pg-query-stream");
const JSONStream     = require("JSONStream");
const es             = require("event-stream");
const Logger         = require("./logger");

let logger = new Logger();

// a transform stream to strip the "trial_json_object" outer json
// container from the results
class StripTrialContainer extends stream.Transform {
  _transform(data, enc, next) {
    data = data.toString();
    let trialContainer = '{"trial_json_object":';
    if (data.includes(trialContainer)) {
      data = data.replace(trialContainer, "");
      data = data.substring(0, data.lastIndexOf("}"));
      // logger.info(`Transformed: ${data}`);
    }
    if (data.length >= 32) {
      logger.info(`Piping "${data.substring(0, 32)}..." to stream...`);
    } else {
      logger.info(`Piping "${data}" to stream...`);
    }
    this.push(data);
    return next();
  }
}

// connect to pg
const CONN_STRING = "postgres://localhost:5432/michaelbalint";
let client = new pg.Client(CONN_STRING);
client.connect((err) => {
  if(err) {
    logger.error(err);
    throw err;
  };
  // load the query sql
  fs.readFile("trial_query.sql", "utf-8", (err, queryString) => {
    // set up the streams
    let qs = client.query(new QueryStream(queryString));
    let js = JSONStream.stringify();
    let ts = new StripTrialContainer();
    let ws = fs.createWriteStream('trials.json');

    // concluding event
    const finished = () => {
      logger.info("Wrote contents to trials.json.");
      client.end();
    };

    // run the query and write the results to file via piping the streams
    qs.pipe(js).pipe(ts).pipe(ws).on("finish", finished);
  });
});