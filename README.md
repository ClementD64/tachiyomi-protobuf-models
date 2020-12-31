# tachiyomi-protobuf-models
Generate Tachiyomi protobuf models directly from sources

## Example
```sh
git clone https://github.com/tachiyomiorg/tachiyomi.git
node generate-models.js tachiyomi.proto
```

> The out file doesn't work with `protoc` but work with [`protobuf.js`](https://github.com/protobufjs/protobuf.js)

## Usage
```
node generate-models.js <output-file> [models-source]

  output-file:    The output file
  models-source:  Path to tachiyomi backup models (default to ./tachiyomi/app/src/main/java/eu/kanade/tachiyomi/data/backup/full/models/)
```
