/**
 * Created by zhengguorong on 16/11/4.
 */
var jsonpatch = require('fast-json-patch')
var File = require('./file.model')
var tools = require('../../util/tools')
var uuid = require('node-uuid')
var multiparty = require('multiparty')
var fs = require('fs')

const respondWithResult = (res, statusCode) => {
  statusCode = statusCode || 200
  return function (entity) {
    if (entity) {
      return res.status(statusCode).json(entity)
    }
    return null
  }
}

const patchUpdates = (patches) => {
  return function (entity) {
    try {
      jsonpatch.apply(entity, patches, /*validate*/ true)
    } catch (err) {
      return Promise.reject(err)
    }

    return entity.save()
  }
}

const removeEntity = (res) => {
  return function (entity) {
    if (entity) {
      return entity.remove()
        .then(() => {
          res.status(204).end()
        })
    }
  }
}

const handleEntityNotFound = (res) => {
  return function (entity) {
    if (!entity) {
      res.status(404).end()
      return null
    }
    return entity
  }
}

const handleError = (res, statusCode) => {
  statusCode = statusCode || 500
  return function (err) {
    res.status(statusCode).send(err)
  }
}

module.exports.index = (req, res) => {
  return File.find().exec()
    .then(respondWithResult(res))
    .catch(handleError(res))
}

// Gets a single File from the DB
module.exports.show = (req, res) => {
  return File.findById(req.params.id).exec()
    .then(handleEntityNotFound(res))
    .then(respondWithResult(res))
    .catch(handleError(res))
}

module.exports.getByThemeId = (req, res) => {
  return File.find({ themeId: req.params.id }).exec()
    .then(handleEntityNotFound(res))
    .then(respondWithResult(res))
    .catch(handleError(res))
}

// Creates a new File in the DB
module.exports.create = (req, res) => {
  if (req.body.imgData) {
    var imageInfo = buildImgPath(req.body.themeId || 'all')
    tools.base64ToImg(req.body.imgData, imageInfo.imagePath)
    req.body.filePath = imageInfo.accessPath
    return File.create(req.body)
        .then(respondWithResult(res, 201))
        .catch(handleError(res))
  } else {
    console.log(req)
    var form = new multiparty.Form()
    form.uploadDir = './public/upload/files/'
    form.parse(req, (err, fields, files) => {
      var filesTmp = JSON.stringify(files, null, 2)
      if (err) {
        console.log(err)
      } else {
        var fileInfo = buildFilePath(fields.themeId[0] || 'all')
        var inputFile = files.inputFile[0]
        var uploadedPath = inputFile.path
        var dstPath = './public/upload/files/' + inputFile.originalFilename
        fs.rename(uploadedPath, dstPath, function (error)  {
          if (error) {
            console.log(error)
          } else {
            console.log('rename ok')
            return File.create({filePath: '/upload/files/' + inputFile.originalFilename, fileName: inputFile.originalFilename})
                .then(respondWithResult(res, 201))
                .catch(handleError(res))
          }
        })
      }
    })
  }
}

const buildImgPath = (themeId) => {
  // 文件使用uuid生成别名
  var fileName = uuid.v1().replace(/-/g, '') + '.png'
  // 文件目录
  var dirPath = 'public/upload/' + themeId
  // 图片保存路径
  var imagePath = dirPath + '/' + fileName
  // 图片访问路径
  var accessPath = '/upload/' + themeId + '/' + fileName
  return { accessPath: accessPath, imagePath: imagePath, dirPath: dirPath }
}

const buildFilePath = (themeId) => {
  // 文件使用uuid生成别名
  var fileName = uuid.v1().replace(/-/g, '')
  // 文件目录
  var dirPath = 'public/upload/files/' + themeId
  // 文件保存路径
  var filePath = dirPath + '/' + fileName
  //  文件访问路径
  var accessPath = '/upload/files/' + themeId + '/' + fileName
  return { accessPath: accessPath, filePath: filePath, dirPath: dirPath }
}
// Deletes a File from the DB
module.exports.destroy = (req, res) => {
  return File.findById(req.params.id).exec()
    .then(handleEntityNotFound(res))
    .then(removeEntity(res))
    .catch(handleError(res))
}
