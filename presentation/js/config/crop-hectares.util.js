export function formatAreaHa(value, locale = "es-PE") {
  return value.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function normalizeChartFilters(filters = {}) {
  const fundo = filters.fundo && filters.fundo !== "all" ? filters.fundo : "all";
  const etapa = filters.etapa && filters.etapa !== "all" ? filters.etapa : "all";
  return { fundo, etapa };
}

export function createHectaresQueries(parcels, fundosOrder) {
  function filterParcels(filters = {}) {
    const { fundo, etapa } = normalizeChartFilters(filters);
    return parcels.filter((parcel) => {
      if (fundo !== "all" && parcel.fundo !== fundo) {
        return false;
      }
      if (etapa !== "all" && parcel.etapa !== etapa) {
        return false;
      }
      return true;
    });
  }

  function getFundosList() {
    return fundosOrder;
  }

  function getParcelsByFundo(fundo) {
    return parcels.filter((parcel) => parcel.fundo === fundo);
  }

  function getUniqueEtapas(filters = {}) {
    return [...new Set(filterParcels(filters).map((parcel) => parcel.etapa))].sort((left, right) =>
      left.localeCompare(right, "es", { numeric: true })
    );
  }

  function getFundoAreaSummary(filters = {}) {
    const scopedParcels = filterParcels(filters);

    return fundosOrder
      .map((fundo) => {
        const fundoParcels = scopedParcels.filter((parcel) => parcel.fundo === fundo);
        const totalAreaHa = fundoParcels.reduce((sum, parcel) => sum + parcel.areaHa, 0);
        const varieties = [...new Set(fundoParcels.map((parcel) => parcel.variedad))];
        const stages = [...new Set(fundoParcels.map((parcel) => parcel.etapa))];
        return { fundo, totalAreaHa, varieties, stages, parcelCount: fundoParcels.length };
      })
      .filter((item) => item.parcelCount > 0);
  }

  function getGlobalStats(filters = {}) {
    const scopedParcels = filterParcels(filters);
    const fundoSummaries = getFundoAreaSummary(filters);
    const allVarieties = new Set(scopedParcels.map((parcel) => parcel.variedad));
    const totalAreaHa = scopedParcels.reduce((sum, parcel) => sum + parcel.areaHa, 0);

    return {
      fundoCount: fundoSummaries.length,
      varietyCount: allVarieties.size,
      parcelCount: scopedParcels.length,
      totalAreaHa
    };
  }

  function getTopVarietiesByArea(limit = 8, filters = {}) {
    const areaByVariety = new Map();
    filterParcels(filters).forEach((parcel) => {
      areaByVariety.set(parcel.variedad, (areaByVariety.get(parcel.variedad) ?? 0) + parcel.areaHa);
    });

    return [...areaByVariety.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, limit)
      .map(([variedad, areaHa]) => ({ variedad, areaHa }));
  }

  function getEtapaAreaSummary(filters = {}) {
    const areaByEtapa = new Map();
    filterParcels(filters).forEach((parcel) => {
      areaByEtapa.set(parcel.etapa, (areaByEtapa.get(parcel.etapa) ?? 0) + parcel.areaHa);
    });

    return [...areaByEtapa.entries()]
      .sort((left, right) => right[1] - left[1])
      .map(([etapa, areaHa]) => ({ etapa, areaHa }));
  }

  return {
    getFundosList,
    getParcelsByFundo,
    getUniqueEtapas,
    getFundoAreaSummary,
    getGlobalStats,
    getTopVarietiesByArea,
    getEtapaAreaSummary
  };
}
