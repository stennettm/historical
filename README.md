[![Build Status](https://secure.travis-ci.org/stennettm/historical.png)](http://travis-ci.org/stennettm/historical)
Historical
==========

A Mongoose plugin that archives document diffs and manages document history.

Historical requires a primary key (typically `_id`) to be present in your schema.

Installation
------------

`npm install historical@^1.0.0`

Getting Started
---------------

Attach the plugin to your schema with any of these optional configuration parameters:

- `name`: Provide a collection name. Defaults to `<collection>_historicals`.
- `connection`: Provide a mongoose connection for the historical collection. Defaults to your schema's connection.
- `primaryKeyName`: Provide your schema's primary key name. Defaults to `_id`.
- `primaryKeyType`: Provide your schema's primary key type. Defaults to your schema's primary key field configuration.

```javascript
var mongoose  = require('mongoose'),
ExampleSchema = new mongoose.Schema({
    myField: String
});

ExampleSchema.plugin(require('historical'), {
    connection: mongoose.createConnection('mongodb://localhost/example'),
    name: null,
    primaryKeyName: null,
    primaryKeyType: null
});
```

Document #historicalDetails()
---------------------------------------------------------

List historical objects for my document up to a point in history.

```javascript
myDocument.historicalDetails(new Date('2010-08-17T12:09:36'), function(e, objs){
   //the list of historical changes for my document
   console.log(objs);
});
```

Document #historicalRestore()
---------------------------------------------------------

Restore a document to a previous point in history.

```javascript
myDocument.historicalRestore(new Date('2010-08-17T12:09:36'), function(e, obj){
   //my document as it was in 2010
   //or null, if it either had not yet been created or was deleted before this time
   if(obj)
      obj.save();
});
```

Document #historicalTrim()
------------------------------------------------------

Trim up to a point in history.

```javascript
myDocument.historicalTrim(new Date('2010-08-17T12:09:36'), function(e, obj){
   //any history before this time has been flattened into one historical document
   //my document as it was provided
   console.log(obj);
});
```

Document #historicalSnapshot()
-----------------------------------------------

Take a complete and current snapshot of my document and store it in history. Unmodified documents only.

```javascript
myDocument.historicalSnapshot(function(e, obj){
   //my document as it was provided
   console.log(obj);
});
```

Document #historicalClear()
--------------------------------------------

Clear all history for my document and take a snapshot. Unmodified documents only.

```javascript
myDocument.historicalClear(function(e, obj){
   //my document as it was provided
   console.log(obj);
});
```
