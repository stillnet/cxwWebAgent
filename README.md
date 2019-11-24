# cxwWebAgent

Monitors response times of websites and logs the data into a PostgreSQL database. Waits 1 second inbetween requests, not including the time the request actually took. So the requests will never "pile up". A request is run, and once it finishes the program waits 1 second before sending the next request to that same site. All sites listed in the configuration file are run concurrently.

## Usage

After downloading:

1. Change directory into cxwWebAgent
2. Run ```npm install```
3. Edit the ```config/default.json5``` configuration file
   * Define some sites to monitor
   * Define a postgreSQL/TimescaleDB database to log the data to
   * Probably want to set ```debuglogging: true```
   * Set ```thissitename``` to a string that indicates your monitoring location. You can try 'auto'.
4. Run the script ```npm start```

You should see logging output indicating data is being sent to your database.
