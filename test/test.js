var assert = require("assert"),
    _ = require('lodash'),
    mongoose = require('mongoose'),
    TestSchema = new mongoose.Schema({
        testString: {
            type: String,
            default: 'My default value'
        },
        testNumber: Number,
        testArray: [String],
        testBoolean: Boolean,
        testObject: {
            testObjectElement: String
        },
        ignoredField: String
    });
TestSchema.plugin(require('../historical.js'), {ignore: ['ignoredField']});

var connection = mongoose.createConnection('mongodb://localhost/historical_test'),
    TestModel = connection.model('test', TestSchema);

describe('Document', function(){

    var document = new TestModel({
        testNumber: 42,
        testArray: ['test1', 'test2'],
        testObject: {
            testObjectElement: 'test message'
        },
        ignoredField: 'This field is ignored'
    });

    describe('#save()', function(){
        it('An historical record should be created when a document is saved.', function(done){
            document.save(function (e, obj) {
                assert.equal(e, null);
                assert.notEqual(obj, null);

                document = obj;

                obj.historical(function (e, details) {
                    assert.equal(e, null);
                    assert.notEqual(details, null);

                    var diff = _.merge(details.pop().diff, {_id: obj._id, __v: obj.__v});
                    
                    assert.strictEqual(diff.ignoredField, undefined);
                    
                    var withoutIgnored = obj.toObject();
                    delete withoutIgnored['ignoredField'];
                    
                    assert.deepEqual(withoutIgnored, diff);
                    assert.equal(obj.testString, 'My default value');
                    
                    done();
                });
            });
        });

        it('An historical record should be created when a document is modified.', function(done){
            document.testObject.testObjectElement = 'this is a test string';
            document.save(function (e, obj) {
                assert.equal(e, null);
                assert.notEqual(obj, null);

                document = obj;

                obj.historical(function (e, details) {
                    assert.equal(e, null);
                    assert.notEqual(details, null);

                    assert.deepEqual(details.pop().diff, {testObject:{testObjectElement: 'this is a test string'}});

                    done();
                });
            });
        });
    });

    describe('#historicalRestore()', function(){
        it('The document should properly flatten to the appropriate point in time.', function(done){
            var time = new Date(),
                previousValue = document.testObject.testObjectElement;
            document.testObject.testObjectElement = 'this message should be overwritten';
            document.testBoolean = true;

            setTimeout(function(){
                document.save(function (e, obj) {

                    assert.equal(obj.testObject.testObjectElement, 'this message should be overwritten');

                    obj.historicalRestore(time, function(e, obj){
                        assert.equal(obj.testObject.testObjectElement, previousValue);
                        assert.equal(obj.testString, 'My default value');

                        obj.save(function(e, obj){
                            document = obj;

                            done();
                        });
                    });
                });
            }, 10);
        });
    });

    describe('#historicalSnapshot()', function(){
        it('A snapshot should render a copy of the entire document to the historical document', function(done){
            document.historicalSnapshot(function(e, obj){
                obj.historical(function(e, details){

                    var diff = _.merge(details.pop().diff, {_id: obj._id, __v: obj.__v});

                    assert.deepEqual(obj.toObject(), diff);

                    done();

                });
            });
        });
    });

    describe('#remove()', function(){
        it('An historical record should be null when a document is removed.', function(done){
            TestModel.findOne({_id: document.id}, function(e, document){
                assert.equal(e, null);

                document.remove(function(e, obj){
                    assert.equal(e, null);
                    assert.notEqual(obj, null);

                    obj.historical(function(e, details){
                        assert.equal(e, null);
                        assert.notEqual(obj, null);

                        assert.equal(details.pop().diff, null);

                        document.historicalRestore(new Date(), function(e, restored){
                            assert.equal(restored, null);
                            done();
                        });
                    });
                });
            });
        });
    });
});
