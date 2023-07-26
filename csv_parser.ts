import * as csvParser from 'csv-parser'
import * as fs from 'fs'

export const readCSV = async (filename: string) => {
    const rows = [];

    const stream = fs.createReadStream(filename)
        .pipe(csvParser.default());

    for await (const row of stream) {
        rows.push(row);
    }

    return rows;
}
