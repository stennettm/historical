var mongoose = require('mongoose'),
    _ = require('underscore'),
    Schema = mongoose.Schema,
    ObjectId = Schema.Types.ObjectId,
    models = [];

_.mixin(require('underscore.deep'));

module.exports = function (schema, options) {
    options = options || {};

    var getHistoricalModel = function (model) {
        var connection = options.connection || model.constructor.collection.conn,
            name = options.name || model.constructor.modelName + 's_historical';

        models[model.constructor.modelName] = models[model.constructor.modelName] === undefined ?
            connection.model(name, new Schema({
                document: { type: ObjectId, index: true },
                timestamp: {type: Date, default: Date.now, index: true},
                diff: Schema.Types.Mixed
            })) : models[model.constructor.modelName];

        return models[model.constructor.modelName];
    };

    var read = function (o, p) {
        for (var i = 0, a = p.split('.'), l = a.length; i < l; i++) {
            o = o[a[i]];
        }
        return o;
    };

    var write = function (o, p, v) {
        for (var i = 0, a = p.split('.'); i < a.length - 1; i++) {
            var n = a[i];
            if (n in o) {
                o = o[n];
            } else {
                o[n] = {};
                o = o[n];
            }
        }
        o[a[a.length - 1]] = v;
    };

    schema.pre('save', function (next) {
        var me = this,
            HistoricalModel = getHistoricalModel(me),
            modified = _.uniq(this.modifiedPaths()),
            diff = {};

        modified.forEach(function (index) {
            var value = read(me, index);
            if (typeof value == 'object') {
                return;
            }
            if (value === undefined) {
                write(diff, index, null);
                return;
            }
            write(diff, index, value);
        });

        var historical = new HistoricalModel({
            document: me.id,
            diff: diff
        });
        historical.save(next);
    });

    schema.methods.historical = function () {
        var me = this,
            action = null,
            date = new Date(),
            callback = function () {
            },
            args = Array.prototype.slice.call(arguments, 0, 3),
            HistoricalModel = getHistoricalModel(me),
            surrogate = {};

        if (typeof args[0] == 'string') {
            action = args[0];
        }

        if (typeof args[1] == 'date') {
            if(args[1].getTime() <= date.getTime()) {
                date = args[1];
            }
            else {
                callback(new Error('Historical error: Future date provided.'));
                return;
            }
        }

        if (typeof args[args.length - 1] == 'function') {
            callback = args[args.length - 1];
        }

        switch (action) {
            case 'snapshot':
                if (me.modifiedPaths().length) {
                    callback(new Error('Historical error: Attempted to snapshot an unsaved/modified document.'));
                    return;
                }
                var historical = new HistoricalModel({
                    document: me.id,
                    diff: me.toObject()
                });
                historical.save(function (e, obj) {
                    if (e) {
                        callback(e);
                        return;
                    }
                    callback(undefined, me);
                });
                break;
            case 'clear':
                HistoricalModel.find({document: me.id}, function (e, objs) {
                    if (e) {
                        callback(e);
                        return;
                    }
                    me.historical('snapshot', function (e, obj) {
                        if (e) {
                            callback(e);
                            return;
                        }
                        objs.forEach(function (obj) {
                            obj.remove();
                        });
                        callback(undefined, me);
                    });
                });
                break;
            case 'restore':
                HistoricalModel.find({document: me.id, timestamp: {$lte: date}}, null, {sort: {timestamp: 1}}, function (e, objs) {
                    if (e) {
                        callback(e);
                        return;
                    }
                    if (!objs) {
                        callback(undefined, null);
                        return;
                    }

                    objs.forEach(function (obj) {
                        surrogate = _.deepExtend(surrogate, obj.diff);
                    });

                    var newObj = new me.constructor(surrogate);
                    newObj.id = me.id;
                    callback(undefined, newObj);
                });
                break;
            case 'trim':
                me.historical('restore', date, function(e, obj){
                    if (e) {
                        callback(e);
                        return;
                    }
                    if (!obj) {
                        callback(undefined, me);
                        return;
                    }
                    HistoricalModel.remove({document: me.id, timestamp: {$lte: date}}, function(e){
                        if (e) {
                            callback(e);
                            return;
                        }
                        var trimmed = new HistoricalModel({
                            document: me.id,
                            diff: obj.toObject(),
                            timestamp: date
                        });
                        trimmed.save(function(e){
                            if (e) {
                                callback(e);
                                return;
                            }
                            callback(undefined, me);
                        });
                    });
                });
                break;
            case 'history':
            default:
                HistoricalModel.find({document: me.id, timestamp: {$lte: date}}, null, {sort: {timestamp: 1}}, function (e, objs) {
                    if (e) {
                        callback(e);
                        return;
                    }
                    callback(undefined, objs);
                });
        }
    };
};