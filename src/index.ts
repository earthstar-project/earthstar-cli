import * as keywing from 'keywing';
import {
    StoreMemory,
    ValidatorKw1,
    IStore,
    Keypair,
    Item,
    StoreSqlite,
    generateKeypair,
} from 'keywing';
import 'fs';
import { appendFile } from 'fs';

//================================================================================
// KEYWING SETUP

let workspace = 'test';
let kw = new StoreMemory([ValidatorKw1], workspace);
//let keypair : Keypair = keywing.generateKeypair();
let keypair : Keypair = {
    public: 'Ki6aDqWS5O5pQlmrQWv2kT97abIWCC0wqbMrwoqoZq0=',
    secret: 'VSdYKDZzl2A4Cm7AW5GGgGWv3MtNKszf7bOcvgW/LRo='
}
let author = keywing.addSigilToKey(keypair.public);

kw.set({
    format: 'kw.1',
    key: 'wiki/kittens',
    value: 'Kittens are small mammals.',
    author: author,
    authorSecret: keypair.secret,
});
kw.set({
    format: 'kw.1',
    key: `~${author}/about/name`,
    value: 'Example Sam',
    author: author,
    authorSecret: keypair.secret,
});
kw.set({
    format: 'kw.1',
    key: `~${author}/about/details`,
    value: 'I am an example author',
    author: author,
    authorSecret: keypair.secret,
});

//================================================================================

import commander = require('commander');
let app = new commander.Command();

app.version('0.0.1');
app
    .command('generate-author')
    .description('')
    .action(() => {
        console.log(JSON.stringify(generateKeypair(), null, 2));
    });
app
    .command('keys <db>')
    .description('List the keys in a database')
    .action((db : string) => {
        let kw = new StoreSqlite([ValidatorKw1], db);
        for (let key of kw.keys()) {
            console.log(key);
        }
    });

app.parse(process.argv);



