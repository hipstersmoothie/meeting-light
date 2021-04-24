// @ts-ignore
import huejay from "huejay";

const TARGET_LIGHT = "Meeting in progress";

/** Set the lights state. Or omit the state to toggle it */
export async function changeLightState(state?: "on" | "off") {
  const [bridge] = await huejay.discover();
  const client = new huejay.Client({
    host: bridge.ip,
    username: "FcJqOpkx2ypbqUhrdTWGog9pAmDKGjpNn04hNITh",
  });

  const lights = await client.lights.getAll();
  const light = lights.find((l: any) => l.name === TARGET_LIGHT);

  light.on = typeof state === "undefined" ? !light.on : state === "on";
  await client.lights.save(light);
}
