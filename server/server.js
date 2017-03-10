/*
   ___   _  _______ __  __ .     . ____          ___   .___    ___        __    __ _ .____  .       __
 .'   \  | '   /    |   |  /     / /   \       .'   `. /   \ .'   \       |     |  | /      /       | 
 |       |     |    |___|  |     | |,_-<       |     | |__-' |             \    /  | |__.   |       | 
 |    _  |     |    |   |  |     | |    `      |     | |  \  |    _         \  /   | |      |  /\   / 
  `.___| /     /    /   /   `._.'  `----'       `.__.' /   \  `.___|         \/    / /----/ |,'  \,'  
*/
const express = require('express');
const rp = require('request-promise');
const { OAuthCode } = require('./authenticate/authenticate.json');

var app = express();
app.use(express.static('public'));
var port = process.env.PORT || 3000;

app.get('/view', (req, res) => {
  var orgName = req.query.orgName, repoName;
  /* for debugging*/
  // var orgName = "facebook", repoName;

  var members = [], repos = [], contribution = {}, totalNumOfCommits = 0;
  var reqCounter = 0, errFound = false;

  //make request to github api v3 for data
  var optionsForMembers = {
    url: `https://api.github.com/orgs/${orgName}/members`,
    headers: {
      'User-Agent': 'request',
      'Authorization': `token ${OAuthCode}`
    },
    json: true
  };

  rp(optionsForMembers)
    .then(function (dataOfMembers) {
      for (var i = 0; i < dataOfMembers.length; i++) {
        members.push({
          login: dataOfMembers[i].login,
          avatarUrl: dataOfMembers[i].avatar_url,
          profileLink: dataOfMembers[i].html_url
        });
      }

      //information about contribution of each member and other data
      for (var i = 0; i < members.length; i++) {
        contribution[members[i].login] = {
          login: members[i].login,
          avatarUrl: members[i].avatarUrl,
          profileLink: members[i].profileLink,
          commits: 0
        };
      }

      // Now we have list of member of the organisation. let's find their indivisual contribution
      // first find the repos

      var optionsForRepos = {
        url: `https://api.github.com/orgs/${orgName}/repos`,
        headers: {
          'User-Agent': 'request',
          'Authorization': `token ${OAuthCode}`

        },
        json: true
      };
      rp(optionsForRepos)
        .then(function (dataOfRepos) {
          for (var i = 0; i < dataOfRepos.length; i++) {
            repos.push(dataOfRepos[i].name);
          }
          // res.send(JSON.stringify(repos));
          console.log(repos);
          /* Now we have repos, so find contribuition repo-wise */
          for (var ptr = 0; ptr < repos.length; ptr++) {
            repoName = repos[ptr];
            // console.log('name: ' + repoName);

            var optionsForContributors = {
              url: `https://api.github.com/repos/${orgName}/${repoName}/stats/contributors`,
              headers: {
                'User-Agent': 'request',
                'Authorization': `token ${OAuthCode}`
              },
              json: true
            };

            // console.log('haha' + optionsForContributors);

            rp(optionsForContributors)
              .then(function (dataOfContributors) {
                reqCounter++;
                // console.log('reqCounter: ' + reqCounter);
                // Check if there is atleast one commit and proceed if repo not empty
                if (dataOfContributors) {
                  for (var k = 0; k < dataOfContributors.length; k++) {
                    let commit = dataOfContributors[k].total;
                    // check if the contribution is by member of the organisation not outsider
                    if (contribution[dataOfContributors[k].author.login]) {
                      contribution[dataOfContributors[k].author.login].commits += commit;
                      /* For DEBUGGING*/
                      // console.log('in the loop,new commit: ' + contribution[dataOfContributors[k].author.login].commits);

                    }
                    totalNumOfCommits += commit;
                  }
                  if (errFound) {
                    return;
                  }
                  if (reqCounter === repos.length) {
                    // Now all the data is captured and processed , send response
                    return res.send(JSON.stringify(contribution));
                  }
                }
              })
              .catch(function (errOfContributors) {
                console.log('error in contributors');
                console.log(errOfContributors);
                errFound = true;
                if (errOfContributors.statusCode === 404) {
                  console.log(errOfContributors);
                  return res.status(404).send(errOfContributors.statusMessage);
                } else {
                  return res.status(500).send(errOfContributors.name);
                }
              });

          }

        })
        .catch(function (errOfRepos) {
          console.log('error in Repos');
          console.log(errOfRepos);
          if (errOfRepos.statusCode === 404) {
            return res.status(404).send(errOfRepos.statusMessage);
          } else {
            return res.status(500).send(errOfRepos.name);
          }
        });

    })
    .catch(function (errOfMembers) {
      console.log('error in members');
      console.log(errOfMembers);
      if (errOfMembers.statusCode === 404) {
        return res.status(404).send(errOfMembers.statusMessage);
      } else {
        //console.log('err of member');
        return res.status(500).send(errOfMembers.name);
      }
    });
});

app.listen(port, () => {
  console.log(`Listening on port: ${port}`);
});
