var assert = require("assert"),
    _ = require('underscore'),
    mongoose = require('mongoose'),
    TestSchema = new mongoose.Schema({
        testString: String,
        testNumber: Number,
        testArray: [String],
        testBoolean: Boolean,
        testObject: {
            testObjectElement: String
        }
    });
TestSchema.plugin(require('../historical.js'));

var connection = mongoose.createConnection('mongodb://localhost/historical_test'),
    TestModel = connection.model('test', TestSchema);

var uniqueId = _.uniqueId();

describe('Document', function(){
    describe('#save()', function(){
        it('An historical record should be created when a document is saved.', function(done){
            var document = new TestModel({
                    testString: uniqueId,
                    testNumber: 42,
                    testArray: ['test1', 'test2'],
                    testBoolean: true,
                    testObject: {
                        testObjectElement: 'test message'
                    }
                });

            document.save(function (e, obj) {
                assert.equal(e, null);
                assert.notEqual(obj, null);

                obj.historical(function (e, details) {
                    assert.equal(e, null);
                    assert.notEqual(details, null);

                    obj._id = undefined;
                    obj.__v = undefined;

                    assert.deepEqual(obj.toObject(), details[0].diff);
                    done();
                });
            });
        });
    });
    describe('#remove()', function(){
        it('An historical record should be null when a document is removed.', function(done){
            TestModel.findOne({testString: uniqueId}, function(e, document){
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