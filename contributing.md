# Contributors' guide!

Hey, thanks for considering to help us out with the project. Before starting to code you need to get a few things set up.


1. Create two directories in the root of the repository with `mkdir anon cache`
2. Create a .env file from our template `.env-copy` with `cp .env-copy .env`
3. Make sure your `DATA_DIR` in the `.env` file is `DATA_DIR=anon`
4. Set your `OPTIMISM_RPC_HTTP_HOST` in the `.env` files 
5. Install the dependencies for the API with `npm i` and for the UI `cd src/web && npm i`
6. Sync with the network using `npm run sync` and when you see it is looping over the same block/address it means we are probably done getting up to date with the network's state.
7. Next run the node in reconciliation mode to catch up with the latest state using `npm run reconcile`. This will take a while and the frontend will not work in this mode! There is a log line which gets incremented each time a new message is successfully stored ("Number of messages added: X"). Watch out for this line and cross check with the chart at "Cumulative Total Messages" https://news.kiwistand.com/basics to understand when you're done reconciling.
8. Once you've reached roughly the messages, you can now start the server using `npm run dev:anon`

```bash
# This is a script to automate the 'Getting started' guide. You WON'T be able to just
# copy and paste this, but it may help you to understand the required steps.
mkdir anon cache
cp .env-copy .env
replacement="OPTIMISM_RPC_HTTP_HOST=YOUR_PRIVATE_URL_HERE"
sed -i "1s/.*/$replacement/" .env # sed magic to replace the first line of the .env file with the OPTIMISM stuff
npm i
cd src/web && npm i && cd ..
npm run sync
npm run reconcile
npm run dev:anon
```

## Docker

You can also run this project with docker! Dockefile and docker-compose.yml files are included! You'll have to follow roughly the same process as above by potentially first adjusting to run your docker file in sync and reconcile mode, and later in production mode

## Project layout

We use ES module (`.mjs` extension) for their simplicity and convenience. The most important files (according to me lol) are:
- `api.mjs` - define the functions used to return the standard JSON messages for the API!*
- `http.mjs` - define the REST routes for the API, you can see how the functions for the feeds, stories, and comments are used.

Those files are kind of the center of the project which allows you to understand why all the others exist.

Thanks for the help!
