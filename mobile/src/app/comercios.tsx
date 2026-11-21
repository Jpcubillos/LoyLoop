import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { CommerceCard } from "@/components/CommerceCard";
import {
  CategoryChip,
  Locations,
  SortOrder,
  SortTrigger,
} from "@/components/CommerceControls";
import {
  Empty,
  Feedback,
  Header,
  Screen,
  SearchField,
  SectionHeader,
  Sheet,
  Tabs,
  Txt,
  ui,
} from "@/components/ui/loyloop";
import { useResource } from "@/hooks/use-resource";
import { getBusinesses } from "@/lib/loyloop-data";

const PAGE_SIZE = 8;
export default function ComerciosScreen() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<"Mis comercios" | "Explorar">(
    params.tab === "explorar" ? "Explorar" : "Mis comercios",
  );
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todos");
  const [sort, setSort] = useState<SortOrder>("Más usados");
  const [map, setMap] = useState(false);
  const [page, setPage] = useState(1);
  const { data = [], loading, error, reload } = useResource(getBusinesses);
  useEffect(() => {
    if (params.tab)
      setTab(params.tab === "explorar" ? "Explorar" : "Mis comercios");
  }, [params.tab]);
  useEffect(() => {
    setPage(1);
  }, [query, category, tab, sort]);
  const filtered = useMemo(() => {
    const normalize = (v: string) =>
      v
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
    return data
      .filter(
        (b) =>
          (tab === "Explorar" || b.isMember) &&
          (category === "Todos" ||
            tab === "Mis comercios" ||
            b.category === category) &&
          normalize(`${b.name} ${b.category}`).includes(normalize(query)),
      )
      .sort((a, b) =>
        sort === "Nombre"
          ? a.name.localeCompare(b.name)
          : sort === "Mejor calificados"
            ? (b.rating ?? 0) - (a.rating ?? 0)
            : sort === "Más cercanos"
              ? (a.distance ?? Infinity) - (b.distance ?? Infinity)
              : b.points - a.points,
      );
  }, [data, tab, query, category, sort]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  );
  return (
    <Screen padding={16}>
      <Header title="Comercios" />
      <Tabs
        items={["Mis comercios", "Explorar"] as const}
        value={tab}
        onChange={setTab}
      />
      <SearchField
        value={query}
        onChange={setQuery}
        placeholder={
          tab === "Mis comercios"
            ? "Buscar en mis comercios…"
            : "Encuentra tu próximo lugar favorito…"
        }
      />
      <SortTrigger value={sort} onChange={setSort} />
      {tab === "Explorar" && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          {["Todos", ...new Set(data.map((b) => b.category))].map((label) => (
            <CategoryChip
              key={label}
              label={label}
              active={category === label}
              onPress={() => setCategory(label)}
            />
          ))}
        </ScrollView>
      )}
      <Feedback loading={loading} error={error} retry={reload} />
      {tab === "Explorar" && filtered.some((b) => b.sponsored) && (
        <View style={{ gap: 12 }}>
          <SectionHeader title="Comercios destacados" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10 }}
          >
            {filtered
              .filter((b) => b.sponsored)
              .map((b) => (
                <CommerceCard key={b.id} business={b} variant="featured" />
              ))}
          </ScrollView>
        </View>
      )}
      <SectionHeader
        title={
          tab === "Mis comercios"
            ? `Tus comercios (${filtered.length})`
            : "Descubre nuevos lugares"
        }
        action="Ver mapa"
        onPress={() => setMap(true)}
      />
      <View style={{ gap: 10 }}>
        {paginated.map((b) => (
          <CommerceCard key={b.id} business={b} />
        ))}
      </View>
      {filtered.length > PAGE_SIZE && (
        <View
          style={[
            ui.row,
            {
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 12,
              paddingHorizontal: 4,
            },
          ]}
        >
          <Txt size={12} color="#756F7C">
            Página {page} de {totalPages} ({filtered.length} comercios)
          </Txt>
          <View style={[ui.row, { gap: 8 }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Página anterior"
              disabled={page <= 1}
              onPress={() => setPage((p) => Math.max(1, p - 1))}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 8,
                backgroundColor: page <= 1 ? "#F1F5F9" : "#FFF",
                borderWidth: 1,
                borderColor: "#E2E8F0",
                opacity: page <= 1 ? 0.4 : 1,
              }}
            >
              <Txt size={12} weight="medium">
                Anterior
              </Txt>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Página siguiente"
              disabled={page >= totalPages}
              onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 8,
                backgroundColor: page >= totalPages ? "#F1F5F9" : "#FFF",
                borderWidth: 1,
                borderColor: "#E2E8F0",
                opacity: page >= totalPages ? 0.4 : 1,
              }}
            >
              <Txt size={12} weight="medium">
                Siguiente
              </Txt>
            </Pressable>
          </View>
        </View>
      )}
      {!loading && !error && !filtered.length && (
        <Empty
          title={
            query || category !== "Todos"
              ? "No encontramos coincidencias"
              : tab === "Mis comercios"
                ? "Aquí empieza tu comunidad"
                : "No hay comercios disponibles"
          }
          description={
            query || category !== "Todos"
              ? "Prueba con otro nombre o categoría."
              : tab === "Mis comercios"
                ? "Explora comercios o escanea su QR para unirte."
                : "Pronto se sumarán más comercios en tu zona."
          }
        />
      )}
      <Sheet visible={map} title="Ubicaciones" onClose={() => setMap(false)}>
        <Locations
          locations={filtered
            .filter((b) => b.address)
            .map((b) => ({
              id: b.id,
              name: b.name,
              address: b.address,
              distance: b.distance,
            }))}
        />
      </Sheet>
    </Screen>
  );
}
