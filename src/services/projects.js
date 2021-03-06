'use strict';

angular.module('openshiftCommonServices')
  .factory('ProjectsService',
    function($location, $q, AuthService, DataService, annotationNameFilter, AuthorizationService, RecentlyViewedProjectsService) {


      var cleanEditableAnnotations = function(resource) {
        var paths = [
              annotationNameFilter('description'),
              annotationNameFilter('displayName')
            ];
        _.each(paths, function(path) {
          if(!resource.metadata.annotations[path]) {
            delete resource.metadata.annotations[path];
          }
        });
        return resource;
      };

      return {
        get: function(projectName) {
          return  AuthService
                    .withUser()
                    .then(function() {
                      var context = {
                        // TODO: swap $.Deferred() for $q.defer()
                        projectPromise: $.Deferred(),
                        projectName: projectName,
                        project: undefined
                      };
                      return DataService
                              .get('projects', projectName, context, {errorNotification: false})
                              .then(function(project) {
                                return AuthorizationService
                                        .getProjectRules(projectName)
                                        .then(function() {
                                          context.project = project;
                                          context.projectPromise.resolve(project);
                                          RecentlyViewedProjectsService.addProjectUID(project.metadata.uid);
                                          // TODO: fix need to return context & projectPromise
                                          return [project, context];
                                        });
                              }, function(e) {
                                context.projectPromise.reject(e);
                                var description = 'The project could not be loaded.';
                                var type = 'error';
                                if(e.status === 403) {
                                  description = 'The project ' + context.projectName + ' does not exist or you are not authorized to view it.';
                                  type = 'access_denied';
                                } else if (e.status === 404) {
                                  description = 'The project ' + context.projectName + ' does not exist.';
                                  type = 'not_found';
                                }
                                $location
                                  .url(
                                    URI('error')
                                      .query({
                                        "error" : type,
                                        "error_description": description
                                      })
                                      .toString());
                                return $q.reject();
                              });
                    });
          },
          update: function(projectName, data) {
            return DataService
                    .update('projects', projectName, cleanEditableAnnotations(data), {projectName: projectName}, {errorNotification: false});
          },
          create: function(name, displayName, description) {
            var projectRequest = {
              apiVersion: "v1",
              kind: "ProjectRequest",
              metadata: {
                name: name
              },
              displayName: displayName,
              description: description
            };
            return DataService
              .create('projectrequests', null, projectRequest, {})
              .then(function(project) {
                RecentlyViewedProjectsService.addProjectUID(project.metadata.uid);
                return project;
              });
          },
          canCreate: function() {
            return DataService.get("projectrequests", null, {}, { errorNotification: false});
          }
        };
    });
