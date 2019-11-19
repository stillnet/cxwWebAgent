# cxwWebAgent

Monitors response times of websites and logs the data into a PostgreSQL databsae

## Usage

After downloading:

1. Change directory into cxwWebAgent
2. Run ```npm install```
3. Edit the ```config/default.json5``` configuration file
   * Define some sites to monitor
   * Define a postgreSQL/TimescaleDB database to log the data to
   * Probably want to set ```debuglogging: true```
4. Run the script ```node app.js```

You should see logging output indicating data is being sent to your database.
