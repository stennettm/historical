Historical
==========

A simple yet helpful Mongoose plugin that records document changes as they occur, and provides
a method for restoring documents to a previous point in time.

This package is currently under development, and should be considered unstable.

Usage
-----

```vim
mySchema.plugin(require('historical'));
```

```vim
myModel.historical(new Date('2003-01-01 00:00:00'), function(e, obj){
   console.log("Here's how my model looked in 2003: "+obj);
   obj.save();
});
```