'use strict';
/**
 * Autor Eugene Demchenko <demchenkoev@gmail.com>
 * Created on 31.03.15.
 * License BSD
 */

function projectControllerFactory(RestController, Controller, ProjectModel, UserModel, utils) {

  Controller.addRouteParamHandler('projectId', function (req, res, next, id) {

    var criteria = {};

    if( utils.uuid.regExp.test(id) ) {
      criteria.projectId = id;
    } else {
      criteria.alias = id;
    }

    ProjectModel.findOne(criteria, function(err, project) {
      if (err) {
        return req.context.error(err);
      }

      if (!project) {
        return req.context.error('PROJECT_NOT_FOUND');
      }

      req.preloaded = req.preloaded || {};
      req.preloaded.project = project;
      req.project = project;
      req.params.projectId = project.projectId;
      if(req.context) {
        req.context.project = project;
        project.saveToContextCache(req.context);
      }
      next();
    });
  });

  class ProjectController extends RestController {

    _getDataFromRequest (req, action, cb) {

      super._getDataFromRequest(req, action, function(err, data) {
        if(data && action === 'create') {
          data.ownerType = req.context.ownerType;
          data.ownerId = req.context.ownerId;
        }
        cb(err, data);
      });
    }

  }

  ProjectController.prototype.model = ProjectModel;
  ProjectController.prototype.path = '/projects';
  ProjectController.prototype.pathId = 'projectId';
  ProjectController.prototype.modelIdFieldName = 'projectId';
  ProjectController.prototype.wrap = 'project';

  return ProjectController;
}

module.exports = {
  ProjectController: ['factory', projectControllerFactory]
}