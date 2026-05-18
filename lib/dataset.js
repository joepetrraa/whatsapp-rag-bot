const fs = require('fs');

const path = require('path');

class DatasetManager {

  constructor() {

    this.dataDir =
      path.join(
        __dirname,
        '..',
        'data'
      );

    this.ensureDataDir();

    this.datasets = new Map();

    this.loadAllDatasets();
  }

  // CREATE DATA DIRECTORY
  ensureDataDir() {

    if (!fs.existsSync(this.dataDir)) {

      fs.mkdirSync(
        this.dataDir,
        { recursive: true }
      );

      console.log(
        `📁 Created data directory:
${this.dataDir}`
      );
    }
  }

  // PARSE CSV
  parseCsvLine(line) {

    const values = [];

    let current = '';

    let insideQuotes = false;

    for (
      let index = 0;
      index < line.length;
      index += 1
    ) {

      const character =
        line[index];

      // HANDLE QUOTES
      if (character === '"') {

        if (
          insideQuotes &&
          line[index + 1] === '"'
        ) {

          current += '"';

          index += 1;

        } else {

          insideQuotes =
            !insideQuotes;
        }

        continue;
      }

      // HANDLE COMMA
      if (
        character === ',' &&
        !insideQuotes
      ) {

        values.push(
          current.trim()
        );

        current = '';

        continue;
      }

      current += character;
    }

    values.push(
      current.trim()
    );

    return values;
  }

  // BUILD TEXT FROM CSV
  buildTextFromCsvRow(
    headers,
    row
  ) {

    const fields = [];

    headers.forEach(
      (header, index) => {

        const value =
          row[index]
            ? row[index].trim()
            : '';

        if (!value) {
          return;
        }

        const normalizedHeader =
          header.toLowerCase();

        // SKIP IMAGE/LINK
        if (
          normalizedHeader.includes('href') ||
          normalizedHeader.includes('src')
        ) {

          return;
        }

        fields.push(
          `${header}: ${value}`
        );
      }
    );

    return fields.join('\n');
  }

  // EXTRACT LABEL
  extractCsvLabel(row) {

    for (const value of row) {

      const cleanValue =
        value
          ? value.trim()
          : '';

      if (!cleanValue) {
        continue;
      }

      if (
        /^https?:\/\//i.test(
          cleanValue
        )
      ) {

        continue;
      }

      if (
        /^data:/i.test(
          cleanValue
        )
      ) {

        continue;
      }

      if (
        /^[\d.,%+-]+$/.test(
          cleanValue
        )
      ) {

        continue;
      }

      if (
        cleanValue.length < 4
      ) {

        continue;
      }

      return cleanValue;
    }

    return 'baris';
  }

  // LOAD CSV
  loadCsvDataset(
    filePath,
    datasetName
  ) {

    const content =
      fs.readFileSync(
        filePath,
        'utf8'
      )
      .replace(/^\uFEFF/, '');

    const lines =
      content
        .split(/\r?\n/)
        .map(line =>
          line.trim()
        )
        .filter(
          line =>
            line.length > 0
        );

    if (lines.length < 2) {

      return {

        name: datasetName,

        file: filePath,

        data: {
          documents: []
        },

        loadedAt:
          new Date()
            .toISOString()
      };
    }

    const headers =
      this.parseCsvLine(lines[0]);

    const documents = [];

    for (
      let index = 1;
      index < lines.length;
      index += 1
    ) {

      const row =
        this.parseCsvLine(
          lines[index]
        );

      const text =
        this.buildTextFromCsvRow(
          headers,
          row
        );

      if (!text) {
        continue;
      }

      const title =
        this.extractCsvLabel(row);

      documents.push({

        source:
          `${datasetName}/${title}`,

        text
      });
    }

    return {

      name: datasetName,

      file: filePath,

      data: {

        metadata: {

          name: datasetName,

          type: 'csv'
        },

        documents
      },

      loadedAt:
        new Date()
          .toISOString()
    };
  }

  // LOAD ALL DATASETS
  loadAllDatasets() {

    try {

      const files =
        fs.readdirSync(
          this.dataDir
        );

      for (const file of files) {

        const filePath =
          path.join(
            this.dataDir,
            file
          );

        try {

          // JSON
          if (
            file.endsWith('.json')
          ) {

            const datasetName =
              file.replace(
                '.json',
                ''
              );

            const content =
              fs.readFileSync(
                filePath,
                'utf8'
              );

            const data =
              JSON.parse(content);

            this.datasets.set(
              datasetName,
              {

                name: datasetName,

                file: filePath,

                data,

                loadedAt:
                  new Date()
                    .toISOString()
              }
            );

            console.log(
              `✅ Loaded dataset:
${datasetName}`
            );
          }

          // CSV
          if (
            file.endsWith('.csv')
          ) {

            const datasetName =
              file.replace(
                '.csv',
                ''
              );

            const dataset =
              this.loadCsvDataset(
                filePath,
                datasetName
              );

            this.datasets.set(
              datasetName,
              dataset
            );

            console.log(
              `✅ Loaded CSV dataset:
${datasetName}`
            );
          }

        } catch (error) {

          console.error(
            `❌ Error loading dataset ${file}:`,
            error.message
          );
        }
      }

      if (
        this.datasets.size === 0
      ) {

        console.log(
          '⚠️ No datasets found'
        );
      }

    } catch (error) {

      console.error(
        'Error loading datasets:',
        error.message
      );
    }
  }

  // GET ALL DOCS
  getAllDocuments() {

    const allDocs = [];

    for (
      const [name, dataset]
      of this.datasets
    ) {

      if (
        dataset.data.documents &&
        Array.isArray(
          dataset.data.documents
        )
      ) {

        for (
          const doc
          of dataset.data.documents
        ) {

          allDocs.push({

            source:
              `${name}/${doc.source || 'unknown'}`,

            text:
              doc.text || ''
          });
        }
      }

      // FAQ
      if (
        dataset.data.faq &&
        Array.isArray(
          dataset.data.faq
        )
      ) {

        for (
          const faq
          of dataset.data.faq
        ) {

          allDocs.push({

            source:
              `${name}/FAQ:
${faq.question || 'unknown'}`,

            text:
              `${faq.question}
${faq.answer}`
          });
        }
      }
    }

    return allDocs;
  }

  // LIST DATASET
  listDatasets() {

    return Array
      .from(
        this.datasets.values()
      )
      .map(dataset => ({

        name:
          dataset.name,

        loadedAt:
          dataset.loadedAt,

        documentCount:
          this.getAllDocuments()
            .length
      }));
  }

  // RELOAD
  reloadDatasets() {

    this.datasets.clear();

    this.loadAllDatasets();
  }
}

module.exports = DatasetManager;