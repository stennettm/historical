Historical
==========

A Mongoose plugin that archives document diffs and provides
a method for restoring documents to any point in time.

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

List historical objects for my document up to a certain Date.

```javascript
myDocument.historical('history', new Date('2010-08-17T12:09:36'), function(e, objs){
   //the list of historical changes for my document
   console.log(objs);
});
```

Restore a document to a previous point in history.

```javascript
myDocument.historical('restore', new Date('2010-08-17T12:09:36'), function(e, obj){
   //my document as it was in 2010
   obj.save();
});
```

Take a complete and current snapshot of my document and store it in history. Unmodified documents only.

```javascript
myDocument.historical('snapshot', function(e, obj){
   //my document as it was for this snapshot
   console.log(obj);
});
```

Clear all history for my document and take a snapshot. Unmodified documents only.

```javascript
myDocument.historical('clear', function(e, obj){
   //my document as it was for this snapshot and history clear
   console.log(obj);
});
```

Todo
-----

* A method to restore an entire collection to any point in time.