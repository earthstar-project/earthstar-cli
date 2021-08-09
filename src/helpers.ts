import {
    existsSync,
    lstatSync,
    readdirSync,
} from 'fs';
import {
    join,
} from 'path';

//================================================================================

export let isDirectory = (p: string) => 
    lstatSync(p).isDirectory();
export let isFile = (p: string) => 
    lstatSync(p).isFile();

// Scan a directory into a flat list of paths, relative to the dirPath, in arbitrary order.
// Example: for the folder "/home/usr/whatever/test-sync-local", this returns:
//   [
//       'test-sync-local/files/apple.txt',
//       'test-sync-local/files/banana-empty.txt',
//       'test-sync-local/files/hello.txt',
//       'test-sync-local/files/vegetables/carrot.txt',
//       'test-sync-local/files/vegetables/cucumber.txt',
//       'test-sync-local/files/vegetables/radish.txt'
//   ]
// This is a synchronous operation.
//
export let walkDir = (dirPath: string): string[] => {
    // handle edge cases
    if (!existsSync(dirPath)) { throw new Error('path does not exist: ' + dirPath); }
    if (!isDirectory(dirPath) && !isFile(dirPath)) { throw new Error('path is neither directory nor file??: ' + dirPath); }
    //if (isFile(dirPath)) { return [ dirPath ] }
    if (!isDirectory(dirPath)) { throw new Error('path is not a directory:' + dirPath); }

    let output: string[] = [];
    let filenames = readdirSync(dirPath);
    for (let filename of filenames) {
        let filePath = join(dirPath, filename);
        if (isDirectory(filePath)) { 
            output = output.concat(walkDir(filePath));
        } else if (isFile(filePath)) {
            output.push(filePath);
        }
    }
    return output;
}

