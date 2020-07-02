#!/bin/bash

echo """
  ____                                      _  __ _
 / ___|___  _ __ ___  _ __ ___  _   _ _ __ (_)/ _(_)_ __ ___
| |   / _ \\| '_ \` _ \\| '_ \` _ \\| | | | '_ \\| | |_| | '__/ _ \\
| |__| (_) | | | | | | | | | | | |_| | | | | |  _| | | |  __/
 \\____\\___/|_| |_| |_|_| |_| |_|\\__,_|_| |_|_|_| |_|_|  \\___|
"""

mongod --fork --replSet rs0 --config /etc/mongod.conf

until mongo --eval "db" &> /dev/null; do
	echo "MongoDB still not ready, sleeping"
	sleep 1
done

sleep 2

# initiate mongo replica set
for i in `seq 1 30`; do
	mongo rocketchat --eval "
	rs.initiate({
		_id: 'rs0',
		members: [ { _id: 0, host: 'localhost:27017' } ]})" &&
	s=$? && break || s=$?;
	echo "Tried $i times. Waiting 5 secs...";
	sleep 5;
done;

sleep 2

# try multiple times until replica set is ready
for i in `seq 1 30`; do
	node main.js &&
	s=$? && break || s=$?;
	echo "Tried $i times. Waiting 5 secs...";
	sleep 5;
done;
