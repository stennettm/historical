[![Build Status](https://secure.travis-ci.org/stennettm/historical.png)](http://travis-ci.org/stennettm/historical)
Historical
==========

A Mongoose plugin that archives document diffs and provides
a method for restoring documents to any point in time.

Requires the `_id` field to be present in your document schema.

This package is currently under development and should be considered unstable.

Installation
------------

`npm install historical`

Usage
-----

Attach the plugin.

```javascript
//provide your desired mongoose connection and/or collection name
var options = {connection: null, name: null};
mySchema.plugin(require('historical'), options);
```

List all historical objects for my document.

```javascript
myDocument.historical(function(e, objs){
   //the list of historical changes for my document
   console.log(objs);
});
```

List historical objects for my document up to a point in history.

```javascript
myDocument.historical('details', new Date('2010-08-17T12:09:36'), function(e, objs){
   //the list of historical changes for my document
   console.log(objs);
});
```

Restore a document to a previous point in history.

```javascript
myDocument.historical('restore', new Date('2010-08-17T12:09:36'), function(e, obj){
   //my document as it was in 2010
   //or null, if it either had not yet been created or was deleted before this time
   if(obj)
      obj.save();
});
```

Trim up to a point in history.

```javascript
myDocument.historical('trim', new Date('2010-08-17T12:09:36'), function(e, obj){
   //any history before this time has been flattened into one historical document
   //my document as it was provided
   console.log(obj);
});
```

Take a complete and current snapshot of my document and store it in history. Unmodified documents only.

```javascript
myDocument.historical('snapshot', function(e, obj){
   //my document as it was provided
   console.log(obj);
});
```

Clear all history for my document and take a snapshot. Unmodified documents only.

```javascript
myDocument.historical('clear', function(e, obj){
   //my document as it was provided
   console.log(obj);
});
```
