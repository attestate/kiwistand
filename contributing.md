# Contributors' guide!
Hey, thanks for considering to help us out with the project. Before starting to code you need to get a few things set up.

1. Create two directories in the root of of the repository with `mkdir anon cache`
2. Create a .env file from our template `.env-copy` with `cp .env-copy .env`
3. Set your `OPTIMISM_RPC_HTTP_HOST` in the `.env` files 
4. Install the dependencies for the API with `npm i` and for the UI `cd src/web && npm i`
5. Sync with the network using `npm run sync` and when you see it is looping over the same block/address it means we are probably done getting up to date with the network's state.
6. Start the server using `npm run dev:anon`

```bash
# This is a script to automate the 'Getting started' guide, help us improve it!
mkdir anon cache
cp .env-copy .env
replacement="OPTIMISM_RPC_HTTP_HOST=YOUR_PRIVATE_URL_HERE"
sed -i "1s/.*/$replacement/" .env # sed magic to replace the first line of the .env file with the OPTIMISM stuff
npm i
cd src/web && npm i && cd ..
npm run sync
npm run dev:anon
```
## Project layout
We use ES module (`.mjs` extension) for their simplicity and convenience. The most important files (according to me lol) are:
- `api.mjs` - define the functions used to return the standard JSON messages for the API!*
- `http.mjs` - define the REST routes for the API, you can see how the functions for the feeds, stories, and comments are used.

Those files are kind of the center of the project which allows you to understand why all the others exist.

Thanks for the help!