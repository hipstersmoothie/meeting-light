import exec from "execa";
import fs from "fs";
import path from "path";
import { changeLightState } from "./change-light-state";

// @ts-ignore
import isCameraOn from "is-camera-on";

interface Meeting {
  title: string;
  meetingUrl?: string;
  startTime: string;
  endTime: string;
  notes: string;
}

const TIME_REGEX = /(\d+):(\d+)/;
const ZOOM_URL_REGEX = /https:\/\/us02web\.zoom\.us\/j\/\d+(?:\?pwd=.+)?/;
const MEETING_TIME_REGEX = /(\d+:\d+ [A|P]M) - (\d+:\d+ [A|P]M)/;
const BULLET = "•";

/** Parse iCalBuddy's output into meeting objects */
function parseMeetings(output: string) {
  const lineIterator = output.split("\n")[Symbol.iterator]();
  const meetings: Meeting[] = [];
  let currentMeeting: Partial<Meeting> = {};

  const addMeeting = (meeting: Partial<Meeting>) => {
    const [meetingUrl] = (meeting.notes || "").match(ZOOM_URL_REGEX) || [];

    if (meetingUrl) {
      currentMeeting.meetingUrl = meetingUrl;
    }

    delete meeting.notes;
    meetings.push(meeting as Meeting);
  };

  for (let line of lineIterator) {
    line = line.trim();

    if (line.startsWith(BULLET)) {
      if (currentMeeting.title) {
        addMeeting(currentMeeting);
        currentMeeting = {};
      }

      currentMeeting.title = line.replace(BULLET, "").trim();
      currentMeeting.notes = "";
    } else if (MEETING_TIME_REGEX.test(line)) {
      const [, startTime, endTime] = line.match(MEETING_TIME_REGEX) || [];
      currentMeeting.startTime = startTime;
      currentMeeting.endTime = endTime;
    } else {
      currentMeeting.notes += `${line}\n`;
    }
  }

  if (currentMeeting.title) {
    addMeeting(currentMeeting);
  }

  return meetings;
}

/** Return a meeting if scheduled to be in one */
async function inMeeting() {
  const result = await exec("icalBuddy", [
    "-ic",
    "alisowski@descript.com",
    "-nc",
    "-nrd",
    "-ea",
    "-eep",
    "attendees",
    "eventsToday",
  ]);

  const currentHours = new Date().getHours();
  const currentMinutes = new Date().getMinutes();
  const meetings = parseMeetings(result.stdout);

  const nextMeeting = meetings.find((m) => {
    const isStartPm = m.startTime.includes("PM");
    const start = m.startTime.match(TIME_REGEX) || [];
    const startHour = Number(start[1]) + (isStartPm ? 12 : 0);
    const startMinutes = Number(start[2]);
    const isAfterStart =
      startHour <= currentHours &&
      (startHour !== currentHours || startMinutes <= currentMinutes);

    const isEndPm = m.startTime.includes("PM");
    const end = m.endTime.match(TIME_REGEX) || [];
    const endHour = Number(end[1]) + (isEndPm ? 12 : 0);
    const endMinutes = Number(end[2]);
    const isBeforeEnd =
      currentHours <= endHour &&
      (endHour !== currentHours || currentMinutes <= endMinutes);

    return isAfterStart && isBeforeEnd;
  });

  return Boolean(nextMeeting);
}

/** Determine if the zoom camera is on */
async function isExternalCameraOn() {
  const { stdout } = await exec("lsof | grep VDC", { shell: true });
  return stdout.includes("caphost");
}

async function determineLightState() {
  if (fs.existsSync(path.join(__dirname, "meeting-light/is-on"))) {
    // Light was manually turned on
    return;
  }

  if (
    (await inMeeting()) ||
    (await isCameraOn()) ||
    (await isExternalCameraOn())
  ) {
    return changeLightState("on");
  }

  return changeLightState("off");
}

determineLightState();
