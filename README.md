Historical
==========

A simple yet helpful Mongoose plugin that records document changes as they occur and provides
a method for restoring documents to a previous point in time.

This package is currently under development and should be considered unstable.

Installation
------------

`npm install historical`

Usage
-----

Attach the plugin.

```vim
mySchema.plugin(require('historical'));
```

List all historical objects for my document.

```vim
myDocument.historical(function(e, objs){
   //the list of historical changes for my document
   console.log(objs);
});
```

List historical objects for my document up to a certain Date.

```vim
myDocument.historical('history', new Date('2010-08-17T12:09:36'), function(e, objs){
   //the list of historical changes for my document
   console.log(objs);
});
```

Restoring a document to a previous point in history.

```vim
myDocument.historical('restore', new Date('2010-08-17T12:09:36'), function(e, obj){
   //my document as it was in 2010
   obj.save();
});
```

Take a complete and current snapshot of my document and store it in history. Unmodified documents only.

```vim
myDocument.historical('snapshot', function(e, obj){
   //my document as it was for this snapshot
   console.log(obj);
});
```

Clear all history for my document and take a snapshot. Unmodified documents only.

```vim
myDocument.historical('clear', function(e, obj){
   //my document as it was for this snapshot and history clear
   console.log(obj);
});
```