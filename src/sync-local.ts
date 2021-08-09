import {
    readFileSync,
    statSync,
} from 'fs';
import {
    basename,
    dirname,
    resolve,
} from 'path';

import {
    sha256base32
} from 'earthstar';

import { walkDir } from './helpers';

//================================================================================

export interface Record {
    baseName: string,
    dirName: string,
    path: string,
    abspath: string,
    size: number,
    inode: number,
    atimeMs: number,  // access time (read)
    mtimeMs: number,  // modified time (write)
    ctimeMs: number,  // changed time (read, write, rename, chown, etc)
    birthtimeMs: number, // created time
    hash: string,
}

export let syncLocalAndSqlite = (dirPath: string, sqlitePath: string): void => {
    console.log('scanning and local directory... ' + dirPath);
    let paths = walkDir(dirPath);
    console.log(`    ...done scanning.  found ${paths.length} files`);
    //console.log(paths);

    console.log(`    ...hashing and reading details for those ${paths.length} files...`);
    let records: Record[] = [];
    for (let path of paths) {
        let stat = statSync(path);
        let record: Record = {
            baseName: basename(path),
            dirName: dirname(path),
            path: path, abspath: resolve(path),
            size: stat.size,  // bytes
            inode: stat.ino,
            atimeMs: stat.atimeMs,
            mtimeMs: stat.mtimeMs,
            ctimeMs: stat.ctimeMs,
            birthtimeMs: stat.birthtimeMs,
            hash: sha256base32(readFileSync(path)),
        }
        records.push(record)
    }
    //console.log(records);
    console.log(`    ...done hashing.  hashed ${records.length} files`);

    // compare manifest file to sqlite and take action

};
