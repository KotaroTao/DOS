import { createTrial } from "./choice-trial.js";
const button = document.querySelector("#measure"), result = document.querySelector("#result");
button.onclick = async () => {
  button.disabled = true;
  const trial = createTrial("measure"); result.replaceChildren(trial.output, trial.button);
  try { await trial.open(); await trial.measure(); }
  catch (error) { trial.output.textContent = error.message; await trial.close().catch(() => {}); }
  finally { button.disabled = false; }
};
