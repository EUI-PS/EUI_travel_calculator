let nutsHierarchy = [];
let travelBands = [];
let countryRates = {};


// =========================================================
// GENERAL HELPERS
// =========================================================

function toNumber(value) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : 0;
}


function normalizeCountryCode(code) {
  if (!code) {
    return "";
  }

  const upper =
    String(code)
      .trim()
      .toUpperCase();

  // Eurostat uses EL for Greece.
  // Some other datasets use GR.
  if (upper === "GR") {
    return "EL";
  }

  return upper;
}


// Change selected country names only for display.
// The source JSON can remain unchanged.
function displayCountryName(name) {
  if (name === "Czech Republic") {
    return "Czechia";
  }

  return name;
}


function formatEuro(value) {
  return new Intl.NumberFormat(
    "en-IE",
    {
      style: "currency",
      currency: "EUR"
    }
  ).format(value);
}


function showResult(html, isError = false) {
  const result =
    document.getElementById("result");

  result.style.display = "block";

  result.className =
    isError
      ? "result error"
      : "result";

  result.innerHTML = html;
}


// =========================================================
// ALPHABETICAL SORT HELPER
// =========================================================

function alphabeticalSort(nameA, nameB) {
  return String(nameA || "").localeCompare(
    String(nameB || ""),
    "en",
    {
      sensitivity: "base"
    }
  );
}


// =========================================================
// EXTRA-REGIO FILTER
// =========================================================

function isExtraRegio(item) {
  const name =
    String(
      item.nuts2_name ||
      item.nuts3_name ||
      ""
    ).toLowerCase();

  const code =
    String(
      item.nuts2_code ||
      item.nuts3_code ||
      ""
    ).toUpperCase();

  const nameIsExtraRegio =
    name.includes("extra-regio");

  const codeIsExtraRegio =
    code.endsWith("ZZ");

  return (
    nameIsExtraRegio ||
    codeIsExtraRegio
  );
}


// =========================================================
// DISTANCE CALCULATION
// =========================================================

function haversineKm(
  lat1,
  lon1,
  lat2,
  lon2
) {
  const earthRadiusKm = 6371;

  const toRadians =
    degrees =>
      degrees * Math.PI / 180;

  const dLat =
    toRadians(
      lat2 - lat1
    );

  const dLon =
    toRadians(
      lon2 - lon1
    );

  const a =
    Math.sin(
      dLat / 2
    ) ** 2

    +

    Math.cos(
      toRadians(lat1)
    )

    *

    Math.cos(
      toRadians(lat2)
    )

    *

    Math.sin(
      dLon / 2
    ) ** 2;

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return earthRadiusKm * c;
}


// =========================================================
// LOAD JSON FILES
// =========================================================

async function loadJson(path) {
  const response =
    await fetch(path);

  if (!response.ok) {
    throw new Error(
      `Could not load ${path}`
    );
  }

  return response.json();
}


async function loadData() {
  try {
    const [
      nutsData,
      travelBandsData,
      countryRatesData
    ] = await Promise.all([
      loadJson(
        "./nuts_hierarchy_eu_2024.json"
      ),

      loadJson(
        "./travel_bands.json"
      ),

      loadJson(
        "./country_rates.json"
      )
    ]);


    nutsHierarchy =
      nutsData;


    travelBands =
      travelBandsData;


    countryRates =
      Object.fromEntries(
        countryRatesData.map(
          rate => [
            normalizeCountryCode(
              rate.country_code
            ),

            {
              ...rate,

              country:
                displayCountryName(
                  rate.country
                )
            }
          ]
        )
      );


    populateCountrySelect(
      "origin"
    );


    populateCountrySelect(
      "destination"
    );

  }

  catch (error) {
    console.error(error);

    showResult(
      `
      Unable to load the calculator data.

      <br><br>

      Please check that the following files are available:

      <br>
      <strong>nuts_hierarchy_eu_2024.json</strong>

      <br>
      <strong>travel_bands.json</strong>

      <br>
      <strong>country_rates.json</strong>
      `,
      true
    );
  }
}


// =========================================================
// COUNTRY DATA
// =========================================================

function getCountryData(countryCode) {
  return nutsHierarchy.find(
    country =>
      normalizeCountryCode(
        country.country_code
      )

      ===

      normalizeCountryCode(
        countryCode
      )
  );
}


// =========================================================
// COUNTRY SELECTORS
// =========================================================

function populateCountrySelect(prefix) {
  const select =
    document.getElementById(
      `${prefix}Country`
    );

  select.innerHTML =
    '<option value="">Select country</option>';


  const sortedCountries =
    [...nutsHierarchy]
      .sort(
        (a, b) =>
          alphabeticalSort(
            displayCountryName(
              a.country_name
            ),
            displayCountryName(
              b.country_name
            )
          )
      );


  sortedCountries.forEach(
    country => {
      const option =
        document.createElement(
          "option"
        );

      option.value =
        country.country_code;

      option.textContent =
        displayCountryName(
          country.country_name
        );

      select.appendChild(
        option
      );
    }
  );


  resetNuts2(
    prefix,
    "Select country first"
  );


  resetNuts3(
    prefix,
    "Select NUTS 2 first"
  );
}


// =========================================================
// RESET SELECTORS
// =========================================================

function resetNuts2(
  prefix,
  message
) {
  const select =
    document.getElementById(
      `${prefix}Nuts2`
    );

  select.innerHTML =
    `<option value="">${message}</option>`;

  select.disabled = true;
}


function resetNuts3(
  prefix,
  message
) {
  const select =
    document.getElementById(
      `${prefix}Nuts3`
    );

  select.innerHTML =
    `<option value="">${message}</option>`;

  select.disabled = true;
}


// =========================================================
// COUNTRY → NUTS 2
// =========================================================

function onCountryChange(prefix) {
  const countryCode =
    document.getElementById(
      `${prefix}Country`
    ).value;


  const nuts2Select =
    document.getElementById(
      `${prefix}Nuts2`
    );


  // Reset NUTS 3 whenever the country changes.
  resetNuts3(
    prefix,
    "Select NUTS 2 first"
  );


  if (!countryCode) {
    resetNuts2(
      prefix,
      "Select country first"
    );

    return;
  }


  const country =
    getCountryData(
      countryCode
    );


  if (!country) {
    resetNuts2(
      prefix,
      "No NUTS 2 found"
    );

    return;
  }


  nuts2Select.innerHTML =
    '<option value="">Select NUTS 2</option>';


  // Remove Extra-Regio and sort alphabetically.
  const availableNuts2 =
    country.nuts2
      .filter(
        nuts2 =>
          !isExtraRegio(
            nuts2
          )
      )
      .sort(
        (a, b) =>
          alphabeticalSort(
            a.nuts2_name,
            b.nuts2_name
          )
      );


  if (
    availableNuts2.length === 0
  ) {
    resetNuts2(
      prefix,
      "No NUTS 2 available"
    );

    return;
  }


  availableNuts2.forEach(
    nuts2 => {
      const option =
        document.createElement(
          "option"
        );

      option.value =
        nuts2.nuts2_code;

      option.textContent =
        `${nuts2.nuts2_name} (${nuts2.nuts2_code})`;

      nuts2Select.appendChild(
        option
      );
    }
  );


  nuts2Select.disabled = false;
}


// =========================================================
// NUTS 2 → NUTS 3
// =========================================================

function onNuts2Change(prefix) {
  const countryCode =
    document.getElementById(
      `${prefix}Country`
    ).value;


  const nuts2Code =
    document.getElementById(
      `${prefix}Nuts2`
    ).value;


  const nuts3Select =
    document.getElementById(
      `${prefix}Nuts3`
    );


  if (
    !countryCode ||
    !nuts2Code
  ) {
    resetNuts3(
      prefix,
      "Select NUTS 2 first"
    );

    return;
  }


  const country =
    getCountryData(
      countryCode
    );


  const nuts2 =
    country?.nuts2.find(
      item =>
        item.nuts2_code ===
        nuts2Code
    );


  if (
    !nuts2 ||
    !nuts2.nuts3
  ) {
    resetNuts3(
      prefix,
      "No NUTS 3 found"
    );

    return;
  }


  // Remove Extra-Regio and sort alphabetically.
  const availableNuts3 =
    nuts2.nuts3
      .filter(
        nuts3 =>
          !isExtraRegio(
            nuts3
          )
      )
      .sort(
        (a, b) =>
          alphabeticalSort(
            a.nuts3_name,
            b.nuts3_name
          )
      );


  if (
    availableNuts3.length === 0
  ) {
    resetNuts3(
      prefix,
      "No NUTS 3 available"
    );

    return;
  }


  nuts3Select.innerHTML =
    '<option value="">Select NUTS 3</option>';


  availableNuts3.forEach(
    nuts3 => {
      const option =
        document.createElement(
          "option"
        );

      option.value =
        nuts3.nuts3_code;

      option.textContent =
        `${nuts3.nuts3_name} (${nuts3.nuts3_code})`;

      nuts3Select.appendChild(
        option
      );
    }
  );


  nuts3Select.disabled = false;
}


// =========================================================
// GET SELECTED NUTS 3
// =========================================================

function getSelectedNuts3(prefix) {
  const countryCode =
    document.getElementById(
      `${prefix}Country`
    ).value;


  const nuts2Code =
    document.getElementById(
      `${prefix}Nuts2`
    ).value;


  const nuts3Code =
    document.getElementById(
      `${prefix}Nuts3`
    ).value;


  if (
    !countryCode ||
    !nuts2Code ||
    !nuts3Code
  ) {
    return null;
  }


  const country =
    getCountryData(
      countryCode
    );


  const nuts2 =
    country?.nuts2.find(
      item =>
        item.nuts2_code ===
        nuts2Code
    );


  const nuts3 =
    nuts2?.nuts3.find(
      item =>
        item.nuts3_code ===
        nuts3Code
    );


  if (
    !country ||
    !nuts2 ||
    !nuts3
  ) {
    return null;
  }


  return {
    country_code:
      normalizeCountryCode(
        country.country_code
      ),

    country_name:
      displayCountryName(
        country.country_name
      ),

    nuts2_code:
      nuts2.nuts2_code,

    nuts2_name:
      nuts2.nuts2_name,

    nuts3_code:
      nuts3.nuts3_code,

    nuts3_name:
      nuts3.nuts3_name,

    lat:
      toNumber(
        nuts3.lat
      ),

    lon:
      toNumber(
        nuts3.lon
      )
  };
}


// =========================================================
// GENERIC TRAVEL BANDS
// =========================================================

function findGenericTravelBand(
  distanceKm
) {
  /*
   * Distances are rounded to the nearest whole km
   * before applying the reimbursement bands.
   *
   * Example:
   * 473.64 km → 474 km
   */

  const bandDistance =
    Math.round(
      distanceKm
    );


  return travelBands.find(
    band => {
      const min =
        toNumber(
          band.min_km
        );

      const max =
        band.max_km === null
          ? Infinity
          : toNumber(
              band.max_km
            );


      return (
        bandDistance >= min
        &&
        bandDistance <= max
      );
    }
  );
}


// =========================================================
// TRAVEL GRANT RULES
// =========================================================

function getTravelRule(
  distanceKm,
  destinationCountryCode,
  isDomestic
) {
  const destinationCode =
    normalizeCountryCode(
      destinationCountryCode
    );


  const country =
    countryRates[
      destinationCode
    ];


  if (!country) {
    return {
      amount: 0,
      rule:
        "No country rate available"
    };
  }


  const roundedDistance =
    Math.round(
      distanceKm
    );


  // =====================================================
  // CROSS-BORDER TRAVEL
  //
  // ALWAYS use generic travel bands.
  // =====================================================

  if (!isDomestic) {
    const band =
      findGenericTravelBand(
        distanceKm
      );


    if (!band) {
      return {
        amount: 0,
        rule:
          "No travel grant defined for this distance"
      };
    }


    const maxLabel =
      band.max_km === null
        ? "+"
        : band.max_km;


    return {
      amount:
        toNumber(
          band.amount_eur
        ),

      rule:
        `${band.min_km}–${maxLabel} km`
    };
  }


  // =====================================================
  // DOMESTIC TRAVEL
  // 50–399 km
  // =====================================================

  if (
    roundedDistance >= 50
    &&
    roundedDistance < 400
  ) {
    return {
      amount:
        toNumber(
          country.domestic_50_400
        ),

      rule:
        `${country.country}: intra-Member State travel (50–400 km)`
    };
  }


  // =====================================================
  // DOMESTIC TRAVEL
  // 400–600 km
  // =====================================================

  if (
    roundedDistance >= 400
    &&
    roundedDistance <= 600
  ) {
    return {
      amount:
        toNumber(
          country.band_400_600
        ),

      rule:
        `${country.country}: intra-Member State travel (400–600 km)`
    };
  }


  // =====================================================
  // OTHER DISTANCES
  //
  // Use generic travel bands.
  // =====================================================

  const genericBand =
    findGenericTravelBand(
      distanceKm
    );


  if (!genericBand) {
    return {
      amount: 0,
      rule:
        "No travel grant defined for this distance"
    };
  }


  const maxLabel =
    genericBand.max_km === null
      ? "+"
      : genericBand.max_km;


  return {
    amount:
      toNumber(
        genericBand.amount_eur
      ),

    rule:
      `${genericBand.min_km}–${maxLabel} km`
  };
}


// =========================================================
// MAIN CALCULATION
// =========================================================

function calculateTravelGrant() {
  const origin =
    getSelectedNuts3(
      "origin"
    );


  const destination =
    getSelectedNuts3(
      "destination"
    );


  if (
    !origin ||
    !destination
  ) {
    showResult(
      "Please select Country, NUTS 2 and NUTS 3 for both origin and destination.",
      true
    );

    return;
  }


  const destinationRates =
    countryRates[
      normalizeCountryCode(
        destination.country_code
      )
    ];


  if (!destinationRates) {
    showResult(
      `No country rates are available for ${destination.country_name}.`,
      true
    );

    return;
  }


  // -----------------------------------------------------
  // CALCULATE NUTS 3 → NUTS 3 DISTANCE
  // -----------------------------------------------------

  const distanceKm =
    haversineKm(
      origin.lat,
      origin.lon,

      destination.lat,
      destination.lon
    );


  // -----------------------------------------------------
  // DOMESTIC OR CROSS-BORDER
  // -----------------------------------------------------

  const isDomestic =
    normalizeCountryCode(
      origin.country_code
    )
    ===
    normalizeCountryCode(
      destination.country_code
    );


  // -----------------------------------------------------
  // FIND TRAVEL GRANT
  // -----------------------------------------------------

  const travelRule =
    getTravelRule(
      distanceKm,
      destination.country_code,
      isDomestic
    );


  const travelAmount =
    travelRule.amount;


  // -----------------------------------------------------
  // DESTINATION COUNTRY PER DIEM
  // -----------------------------------------------------

  const perDiem =
    toNumber(
      destinationRates.per_diem
    );


  // -----------------------------------------------------
  // DISPLAY RESULT
  // -----------------------------------------------------

  showResult(`

    <div class="result-title">
      Trip details
    </div>


    <div>
      <strong>
        Origin:
      </strong>

      ${origin.nuts3_name}
      (${origin.nuts3_code}),
      ${origin.nuts2_name},
      ${origin.country_name}
    </div>


    <div>
      <strong>
        Destination:
      </strong>

      ${destination.nuts3_name}
      (${destination.nuts3_code}),
      ${destination.nuts2_name},
      ${destination.country_name}
    </div>


    <div>
      <strong>
        Distance:
      </strong>

      ${distanceKm.toFixed(2)} km
    </div>


    <div class="result-section">

      <strong>
        Estimated travel grant
        (per participant):
      </strong>


      <div class="grant">

        Travel cost =
        1 × ${formatEuro(travelAmount)}
        =

        <span class="amount">
          ${formatEuro(travelAmount)}
        </span>

      </div>

    </div>


    <div class="result-section">

      <strong>
        Estimated country per diem
        (per day):
      </strong>


      <div class="per-diem">

        Per diem in
        ${destinationRates.country}
        =

        <span class="amount">
          ${formatEuro(perDiem)}
        </span>

      </div>

    </div>

  `);
}


// =========================================================
// EVENTS
// =========================================================

document
  .getElementById(
    "originCountry"
  )
  .addEventListener(
    "change",
    () =>
      onCountryChange(
        "origin"
      )
  );


document
  .getElementById(
    "originNuts2"
  )
  .addEventListener(
    "change",
    () =>
      onNuts2Change(
        "origin"
      )
  );


document
  .getElementById(
    "destinationCountry"
  )
  .addEventListener(
    "change",
    () =>
      onCountryChange(
        "destination"
      )
  );


document
  .getElementById(
    "destinationNuts2"
  )
  .addEventListener(
    "change",
    () =>
      onNuts2Change(
        "destination"
      )
  );


document
  .getElementById(
    "calculateBtn"
  )
  .addEventListener(
    "click",
    calculateTravelGrant
  );


// =========================================================
// INITIALISE CALCULATOR
// =========================================================

loadData();