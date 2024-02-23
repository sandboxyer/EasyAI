import https from 'https';
import { createWriteStream } from 'fs';
import { unlink } from 'fs/promises';
import { basename } from 'path';

const printProgress = (downloaded, total) => {
    const percentage = (downloaded / total) * 100;
    const progressBarLength = 50;
    const numberOfBlocks = Math.floor((percentage / 100) * progressBarLength);
    const progressBlocks = '#'.repeat(numberOfBlocks);
    const emptyBlocks = ' '.repeat(progressBarLength - numberOfBlocks);
    process.stdout.clearLine(0); // Make sure to pass 0 to clearLine
    process.stdout.cursorTo(0);
    process.stdout.write(`Downloading File: [${progressBlocks}${emptyBlocks}] ${percentage.toFixed(2)}}%`);
};

const downloadFile = (url, dest = '') => {
    return new Promise((resolve, reject) => {
        // Determine the filename from the URL if not provided
        const fileName = dest || `${process.cwd()}/${basename(new URL(url).pathname)}`;
        const file = createWriteStream(fileName);

        const download = (currentUrl) => {
            https.get(currentUrl, (response) => {
                if (response.statusCode === 200) {
                    const totalBytes = Number(response.headers['content-length']);
                    let downloadedBytes = 0;

                    response.on('data', (chunk) => {
                        downloadedBytes += chunk.length;
                        printProgress(downloadedBytes, totalBytes); // Call standalone function
                        file.write(chunk);
                    });

                    response.on('end', () => {
                        file.end(() => {
                            console.log(`\nFile downloaded to ${fileName}`);
                            resolve(fileName); // Resolve with the filename
                        });
                    });
                } else if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                    // Handle redirects
                    const newUrl = new URL(response.headers.location, currentUrl).toString();
                    download(newUrl);
                } else {
                    // Reject on unsuccessful status codes
                    file.close(() => {
                        unlink(fileName).catch(() => {}); // Attempt to delete the file asynchronously
                        reject(new Error(`Failed to download file. HTTP Status: ${response.statusCode}`));
                    });
                }
            }).on('error', (err) => {
                file.close(() => {
                    unlink(fileName).catch(() => {}); // Attempt to delete the file asynchronously
                    reject(err);
                });
            });
        };

        download(url);
    });
};

export default downloadFile;
