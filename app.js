document.addEventListener("DOMContentLoaded", () => {
  const hoursEl = document.getElementById("hours");
  for (let h = 8; h <= 20; h++) {
    const div = document.createElement("div");
    div.textContent = h + ":00";
    div.style.marginBottom = "1rem";
    hoursEl.appendChild(div);
  }

  const calendarGrid = document.getElementById("calendarGrid");
  for (let i = 0; i < 9; i++) {
    const card = document.createElement("div");
    card.className = "appointment-card";
    card.textContent = "Appuntamento " + (i + 1);
    calendarGrid.appendChild(card);
  }
});