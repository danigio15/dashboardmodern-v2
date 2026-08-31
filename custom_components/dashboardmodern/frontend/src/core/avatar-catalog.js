/* GENERATO da scripts/costruisci-avatar-3d.mjs — non si modifica a mano.
 *
 * I ritratti sono i render 3D di Fluent Emoji (Microsoft, licenza MIT). Qui
 * ci sono solo i nomi dei file e le misure prese in fase di build: dove sta
 * la testa in ogni immagine — serve a incollare la testa scelta sul busto
 * scelto — e dove stanno gli occhi, che servono a farli sbattere.
 */
export const AVATAR_LATO = 192;
export const AVATAR_PERSONE = [
  { key: "uomo", capelli: true },
  { key: "donna", capelli: true },
  { key: "neutro", capelli: true },
  { key: "ragazzo", capelli: false },
  { key: "ragazza", capelli: false },
  { key: "anziano", capelli: false },
  { key: "anziana", capelli: false },
];
export const AVATAR_CAPELLI = [
  { key: "lisci" },
  { key: "barba" },
  { key: "ricci" },
  { key: "rossi" },
  { key: "bianchi" },
  { key: "biondi" },
  { key: "calvo" },
];
export const AVATAR_CARNAGIONI = [
  { key: "chiara" },
  { key: "chiara2" },
  { key: "media" },
  { key: "ambrata" },
  { key: "scura" },
];
export const AVATAR_VESTITI = [
  { key: "ufficio", ricolorabile: true },
  { key: "medico", ricolorabile: true },
  { key: "cuoco" },
  { key: "smoking" },
  { key: "velo" },
  { key: "pompiere" },
  { key: "poliziotto" },
  { key: "muratore" },
  { key: "operaio" },
  { key: "meccanico" },
  { key: "contadino" },
  { key: "pilota" },
  { key: "astronauta" },
  { key: "giudice" },
  { key: "supereroe" },
  { key: "scienziato" },
  { key: "insegnante" },
  { key: "studente" },
  { key: "informatico" },
  { key: "artista" },
  { key: "cantante" },
  { key: "guardia" },
  { key: "detective" },
  { key: "turbante" },
  { key: "supercattivo" },
  { key: "mago" },
  { key: "fata" },
  { key: "vampiro" },
  { key: "elfo" },
  { key: "casual", ricolorabile: true },
  { key: "saluto", ricolorabile: true },
  { key: "polo", ricolorabile: true, sintetico: "casual" },
  { key: "camicia", ricolorabile: true, sintetico: "casual" },
  { key: "attesa", ricolorabile: true },
];
export const AVATAR_TESTE = {
  "uomo|lisci|chiara": "man_light",
  "uomo|lisci|chiara2": "man_medium_light",
  "uomo|lisci|media": "man_medium",
  "uomo|lisci|ambrata": "man_medium_dark",
  "uomo|lisci|scura": "man_dark",
  "uomo|barba|chiara": "man_beard_light",
  "uomo|barba|chiara2": "man_beard_medium_light",
  "uomo|barba|media": "man_beard_medium",
  "uomo|barba|ambrata": "man_beard_medium_dark",
  "uomo|barba|scura": "man_beard_dark",
  "uomo|ricci|chiara": "man_curly_hair_light",
  "uomo|ricci|chiara2": "man_curly_hair_medium_light",
  "uomo|ricci|media": "man_curly_hair_medium",
  "uomo|ricci|ambrata": "man_curly_hair_medium_dark",
  "uomo|ricci|scura": "man_curly_hair_dark",
  "uomo|rossi|chiara": "man_red_hair_light",
  "uomo|rossi|chiara2": "man_red_hair_medium_light",
  "uomo|rossi|media": "man_red_hair_medium",
  "uomo|rossi|ambrata": "man_red_hair_medium_dark",
  "uomo|rossi|scura": "man_red_hair_dark",
  "uomo|bianchi|chiara": "man_white_hair_light",
  "uomo|bianchi|chiara2": "man_white_hair_medium_light",
  "uomo|bianchi|media": "man_white_hair_medium",
  "uomo|bianchi|ambrata": "man_white_hair_medium_dark",
  "uomo|bianchi|scura": "man_white_hair_dark",
  "uomo|biondi|chiara": "man_blonde_hair_light",
  "uomo|biondi|chiara2": "man_blonde_hair_medium_light",
  "uomo|biondi|media": "man_blonde_hair_medium",
  "uomo|biondi|ambrata": "man_blonde_hair_medium_dark",
  "uomo|biondi|scura": "man_blonde_hair_dark",
  "uomo|calvo|chiara": "man_bald_light",
  "uomo|calvo|chiara2": "man_bald_medium_light",
  "uomo|calvo|media": "man_bald_medium",
  "uomo|calvo|ambrata": "man_bald_medium_dark",
  "uomo|calvo|scura": "man_bald_dark",
  "donna|lisci|chiara": "woman_light",
  "donna|lisci|chiara2": "woman_medium_light",
  "donna|lisci|media": "woman_medium",
  "donna|lisci|ambrata": "woman_medium_dark",
  "donna|lisci|scura": "woman_dark",
  "donna|barba|chiara": "woman_beard_light",
  "donna|barba|chiara2": "woman_beard_medium_light",
  "donna|barba|media": "woman_beard_medium",
  "donna|barba|ambrata": "woman_beard_medium_dark",
  "donna|barba|scura": "woman_beard_dark",
  "donna|ricci|chiara": "woman_curly_hair_light",
  "donna|ricci|chiara2": "woman_curly_hair_medium_light",
  "donna|ricci|media": "woman_curly_hair_medium",
  "donna|ricci|ambrata": "woman_curly_hair_medium_dark",
  "donna|ricci|scura": "woman_curly_hair_dark",
  "donna|rossi|chiara": "woman_red_hair_light",
  "donna|rossi|chiara2": "woman_red_hair_medium_light",
  "donna|rossi|media": "woman_red_hair_medium",
  "donna|rossi|ambrata": "woman_red_hair_medium_dark",
  "donna|rossi|scura": "woman_red_hair_dark",
  "donna|bianchi|chiara": "woman_white_hair_light",
  "donna|bianchi|chiara2": "woman_white_hair_medium_light",
  "donna|bianchi|media": "woman_white_hair_medium",
  "donna|bianchi|ambrata": "woman_white_hair_medium_dark",
  "donna|bianchi|scura": "woman_white_hair_dark",
  "donna|biondi|chiara": "woman_blonde_hair_light",
  "donna|biondi|chiara2": "woman_blonde_hair_medium_light",
  "donna|biondi|media": "woman_blonde_hair_medium",
  "donna|biondi|ambrata": "woman_blonde_hair_medium_dark",
  "donna|biondi|scura": "woman_blonde_hair_dark",
  "donna|calvo|chiara": "woman_bald_light",
  "donna|calvo|chiara2": "woman_bald_medium_light",
  "donna|calvo|media": "woman_bald_medium",
  "donna|calvo|ambrata": "woman_bald_medium_dark",
  "donna|calvo|scura": "woman_bald_dark",
  "neutro|lisci|chiara": "person_light",
  "neutro|lisci|chiara2": "person_medium_light",
  "neutro|lisci|media": "person_medium",
  "neutro|lisci|ambrata": "person_medium_dark",
  "neutro|lisci|scura": "person_dark",
  "neutro|barba|chiara": "person_beard_light",
  "neutro|barba|chiara2": "person_beard_medium_light",
  "neutro|barba|media": "person_beard_medium",
  "neutro|barba|ambrata": "person_beard_medium_dark",
  "neutro|barba|scura": "person_beard_dark",
  "neutro|ricci|chiara": "person_curly_hair_light",
  "neutro|ricci|chiara2": "person_curly_hair_medium_light",
  "neutro|ricci|media": "person_curly_hair_medium",
  "neutro|ricci|ambrata": "person_curly_hair_medium_dark",
  "neutro|ricci|scura": "person_curly_hair_dark",
  "neutro|rossi|chiara": "person_red_hair_light",
  "neutro|rossi|chiara2": "person_red_hair_medium_light",
  "neutro|rossi|media": "person_red_hair_medium",
  "neutro|rossi|ambrata": "person_red_hair_medium_dark",
  "neutro|rossi|scura": "person_red_hair_dark",
  "neutro|bianchi|chiara": "person_white_hair_light",
  "neutro|bianchi|chiara2": "person_white_hair_medium_light",
  "neutro|bianchi|media": "person_white_hair_medium",
  "neutro|bianchi|ambrata": "person_white_hair_medium_dark",
  "neutro|bianchi|scura": "person_white_hair_dark",
  "neutro|biondi|chiara": "person_blonde_hair_light",
  "neutro|biondi|chiara2": "person_blonde_hair_medium_light",
  "neutro|biondi|media": "person_blonde_hair_medium",
  "neutro|biondi|ambrata": "person_blonde_hair_medium_dark",
  "neutro|biondi|scura": "person_blonde_hair_dark",
  "neutro|calvo|chiara": "person_bald_light",
  "neutro|calvo|chiara2": "person_bald_medium_light",
  "neutro|calvo|media": "person_bald_medium",
  "neutro|calvo|ambrata": "person_bald_medium_dark",
  "neutro|calvo|scura": "person_bald_dark",
  "ragazzo||chiara": "boy_light",
  "ragazzo||chiara2": "boy_medium_light",
  "ragazzo||media": "boy_medium",
  "ragazzo||ambrata": "boy_medium_dark",
  "ragazzo||scura": "boy_dark",
  "ragazza||chiara": "girl_light",
  "ragazza||chiara2": "girl_medium_light",
  "ragazza||media": "girl_medium",
  "ragazza||ambrata": "girl_medium_dark",
  "ragazza||scura": "girl_dark",
  "anziano||chiara": "old_man_light",
  "anziano||chiara2": "old_man_medium_light",
  "anziano||media": "old_man_medium",
  "anziano||ambrata": "old_man_medium_dark",
  "anziano||scura": "old_man_dark",
  "anziana||chiara": "old_woman_light",
  "anziana||chiara2": "old_woman_medium_light",
  "anziana||media": "old_woman_medium",
  "anziana||ambrata": "old_woman_medium_dark",
  "anziana||scura": "old_woman_dark",
};
export const AVATAR_BUSTI = {
  "ufficio|uomo|chiara": "man_office_worker_light",
  "ufficio|uomo|chiara2": "man_office_worker_medium_light",
  "ufficio|uomo|media": "man_office_worker_medium",
  "ufficio|uomo|ambrata": "man_office_worker_medium_dark",
  "ufficio|uomo|scura": "man_office_worker_dark",
  "ufficio|donna|chiara": "woman_office_worker_light",
  "ufficio|donna|chiara2": "woman_office_worker_medium_light",
  "ufficio|donna|media": "woman_office_worker_medium",
  "ufficio|donna|ambrata": "woman_office_worker_medium_dark",
  "ufficio|donna|scura": "woman_office_worker_dark",
  "medico|uomo|chiara": "man_health_worker_light",
  "medico|uomo|chiara2": "man_health_worker_medium_light",
  "medico|uomo|media": "man_health_worker_medium",
  "medico|uomo|ambrata": "man_health_worker_medium_dark",
  "medico|uomo|scura": "man_health_worker_dark",
  "medico|donna|chiara": "woman_health_worker_light",
  "medico|donna|chiara2": "woman_health_worker_medium_light",
  "medico|donna|media": "woman_health_worker_medium",
  "medico|donna|ambrata": "woman_health_worker_medium_dark",
  "medico|donna|scura": "woman_health_worker_dark",
  "cuoco|uomo|chiara": "man_cook_light",
  "cuoco|uomo|chiara2": "man_cook_medium_light",
  "cuoco|uomo|media": "man_cook_medium",
  "cuoco|uomo|ambrata": "man_cook_medium_dark",
  "cuoco|uomo|scura": "man_cook_dark",
  "cuoco|donna|chiara": "woman_cook_light",
  "cuoco|donna|chiara2": "woman_cook_medium_light",
  "cuoco|donna|media": "woman_cook_medium",
  "cuoco|donna|ambrata": "woman_cook_medium_dark",
  "cuoco|donna|scura": "woman_cook_dark",
  "smoking|uomo|chiara": "man_in_tuxedo_light",
  "smoking|uomo|chiara2": "man_in_tuxedo_medium_light",
  "smoking|uomo|media": "man_in_tuxedo_medium",
  "smoking|uomo|ambrata": "man_in_tuxedo_medium_dark",
  "smoking|uomo|scura": "man_in_tuxedo_dark",
  "smoking|donna|chiara": "woman_in_tuxedo_light",
  "smoking|donna|chiara2": "woman_in_tuxedo_medium_light",
  "smoking|donna|media": "woman_in_tuxedo_medium",
  "smoking|donna|ambrata": "woman_in_tuxedo_medium_dark",
  "smoking|donna|scura": "woman_in_tuxedo_dark",
  "velo|uomo|chiara": "man_with_veil_light",
  "velo|uomo|chiara2": "man_with_veil_medium_light",
  "velo|uomo|media": "man_with_veil_medium",
  "velo|uomo|ambrata": "man_with_veil_medium_dark",
  "velo|uomo|scura": "man_with_veil_dark",
  "velo|donna|chiara": "woman_with_veil_light",
  "velo|donna|chiara2": "woman_with_veil_medium_light",
  "velo|donna|media": "woman_with_veil_medium",
  "velo|donna|ambrata": "woman_with_veil_medium_dark",
  "velo|donna|scura": "woman_with_veil_dark",
  "pompiere|uomo|chiara": "man_firefighter_light",
  "pompiere|uomo|chiara2": "man_firefighter_medium_light",
  "pompiere|uomo|media": "man_firefighter_medium",
  "pompiere|uomo|ambrata": "man_firefighter_medium_dark",
  "pompiere|uomo|scura": "man_firefighter_dark",
  "pompiere|donna|chiara": "woman_firefighter_light",
  "pompiere|donna|chiara2": "woman_firefighter_medium_light",
  "pompiere|donna|media": "woman_firefighter_medium",
  "pompiere|donna|ambrata": "woman_firefighter_medium_dark",
  "pompiere|donna|scura": "woman_firefighter_dark",
  "poliziotto|uomo|chiara": "man_police_officer_light",
  "poliziotto|uomo|chiara2": "man_police_officer_medium_light",
  "poliziotto|uomo|media": "man_police_officer_medium",
  "poliziotto|uomo|ambrata": "man_police_officer_medium_dark",
  "poliziotto|uomo|scura": "man_police_officer_dark",
  "poliziotto|donna|chiara": "woman_police_officer_light",
  "poliziotto|donna|chiara2": "woman_police_officer_medium_light",
  "poliziotto|donna|media": "woman_police_officer_medium",
  "poliziotto|donna|ambrata": "woman_police_officer_medium_dark",
  "poliziotto|donna|scura": "woman_police_officer_dark",
  "muratore|uomo|chiara": "man_construction_worker_light",
  "muratore|uomo|chiara2": "man_construction_worker_medium_light",
  "muratore|uomo|media": "man_construction_worker_medium",
  "muratore|uomo|ambrata": "man_construction_worker_medium_dark",
  "muratore|uomo|scura": "man_construction_worker_dark",
  "muratore|donna|chiara": "woman_construction_worker_light",
  "muratore|donna|chiara2": "woman_construction_worker_medium_light",
  "muratore|donna|media": "woman_construction_worker_medium",
  "muratore|donna|ambrata": "woman_construction_worker_medium_dark",
  "muratore|donna|scura": "woman_construction_worker_dark",
  "operaio|uomo|chiara": "man_factory_worker_light",
  "operaio|uomo|chiara2": "man_factory_worker_medium_light",
  "operaio|uomo|media": "man_factory_worker_medium",
  "operaio|uomo|ambrata": "man_factory_worker_medium_dark",
  "operaio|uomo|scura": "man_factory_worker_dark",
  "operaio|donna|chiara": "woman_factory_worker_light",
  "operaio|donna|chiara2": "woman_factory_worker_medium_light",
  "operaio|donna|media": "woman_factory_worker_medium",
  "operaio|donna|ambrata": "woman_factory_worker_medium_dark",
  "operaio|donna|scura": "woman_factory_worker_dark",
  "meccanico|uomo|chiara": "man_mechanic_light",
  "meccanico|uomo|chiara2": "man_mechanic_medium_light",
  "meccanico|uomo|media": "man_mechanic_medium",
  "meccanico|uomo|ambrata": "man_mechanic_medium_dark",
  "meccanico|uomo|scura": "man_mechanic_dark",
  "meccanico|donna|chiara": "woman_mechanic_light",
  "meccanico|donna|chiara2": "woman_mechanic_medium_light",
  "meccanico|donna|media": "woman_mechanic_medium",
  "meccanico|donna|ambrata": "woman_mechanic_medium_dark",
  "meccanico|donna|scura": "woman_mechanic_dark",
  "contadino|uomo|chiara": "man_farmer_light",
  "contadino|uomo|chiara2": "man_farmer_medium_light",
  "contadino|uomo|media": "man_farmer_medium",
  "contadino|uomo|ambrata": "man_farmer_medium_dark",
  "contadino|uomo|scura": "man_farmer_dark",
  "contadino|donna|chiara": "woman_farmer_light",
  "contadino|donna|chiara2": "woman_farmer_medium_light",
  "contadino|donna|media": "woman_farmer_medium",
  "contadino|donna|ambrata": "woman_farmer_medium_dark",
  "contadino|donna|scura": "woman_farmer_dark",
  "pilota|uomo|chiara": "man_pilot_light",
  "pilota|uomo|chiara2": "man_pilot_medium_light",
  "pilota|uomo|media": "man_pilot_medium",
  "pilota|uomo|ambrata": "man_pilot_medium_dark",
  "pilota|uomo|scura": "man_pilot_dark",
  "pilota|donna|chiara": "woman_pilot_light",
  "pilota|donna|chiara2": "woman_pilot_medium_light",
  "pilota|donna|media": "woman_pilot_medium",
  "pilota|donna|ambrata": "woman_pilot_medium_dark",
  "pilota|donna|scura": "woman_pilot_dark",
  "astronauta|uomo|chiara": "man_astronaut_light",
  "astronauta|uomo|chiara2": "man_astronaut_medium_light",
  "astronauta|uomo|media": "man_astronaut_medium",
  "astronauta|uomo|ambrata": "man_astronaut_medium_dark",
  "astronauta|uomo|scura": "man_astronaut_dark",
  "astronauta|donna|chiara": "woman_astronaut_light",
  "astronauta|donna|chiara2": "woman_astronaut_medium_light",
  "astronauta|donna|media": "woman_astronaut_medium",
  "astronauta|donna|ambrata": "woman_astronaut_medium_dark",
  "astronauta|donna|scura": "woman_astronaut_dark",
  "giudice|uomo|chiara": "man_judge_light",
  "giudice|uomo|chiara2": "man_judge_medium_light",
  "giudice|uomo|media": "man_judge_medium",
  "giudice|uomo|ambrata": "man_judge_medium_dark",
  "giudice|uomo|scura": "man_judge_dark",
  "giudice|donna|chiara": "woman_judge_light",
  "giudice|donna|chiara2": "woman_judge_medium_light",
  "giudice|donna|media": "woman_judge_medium",
  "giudice|donna|ambrata": "woman_judge_medium_dark",
  "giudice|donna|scura": "woman_judge_dark",
  "supereroe|uomo|chiara": "man_superhero_light",
  "supereroe|uomo|chiara2": "man_superhero_medium_light",
  "supereroe|uomo|media": "man_superhero_medium",
  "supereroe|uomo|ambrata": "man_superhero_medium_dark",
  "supereroe|uomo|scura": "man_superhero_dark",
  "supereroe|donna|chiara": "woman_superhero_light",
  "supereroe|donna|chiara2": "woman_superhero_medium_light",
  "supereroe|donna|media": "woman_superhero_medium",
  "supereroe|donna|ambrata": "woman_superhero_medium_dark",
  "supereroe|donna|scura": "woman_superhero_dark",
  "scienziato|uomo|chiara": "man_scientist_light",
  "scienziato|uomo|chiara2": "man_scientist_medium_light",
  "scienziato|uomo|media": "man_scientist_medium",
  "scienziato|uomo|ambrata": "man_scientist_medium_dark",
  "scienziato|uomo|scura": "man_scientist_dark",
  "scienziato|donna|chiara": "woman_scientist_light",
  "scienziato|donna|chiara2": "woman_scientist_medium_light",
  "scienziato|donna|media": "woman_scientist_medium",
  "scienziato|donna|ambrata": "woman_scientist_medium_dark",
  "scienziato|donna|scura": "woman_scientist_dark",
  "insegnante|uomo|chiara": "man_teacher_light",
  "insegnante|uomo|chiara2": "man_teacher_medium_light",
  "insegnante|uomo|media": "man_teacher_medium",
  "insegnante|uomo|ambrata": "man_teacher_medium_dark",
  "insegnante|uomo|scura": "man_teacher_dark",
  "insegnante|donna|chiara": "woman_teacher_light",
  "insegnante|donna|chiara2": "woman_teacher_medium_light",
  "insegnante|donna|media": "woman_teacher_medium",
  "insegnante|donna|ambrata": "woman_teacher_medium_dark",
  "insegnante|donna|scura": "woman_teacher_dark",
  "studente|uomo|chiara": "man_student_light",
  "studente|uomo|chiara2": "man_student_medium_light",
  "studente|uomo|media": "man_student_medium",
  "studente|uomo|ambrata": "man_student_medium_dark",
  "studente|uomo|scura": "man_student_dark",
  "studente|donna|chiara": "woman_student_light",
  "studente|donna|chiara2": "woman_student_medium_light",
  "studente|donna|media": "woman_student_medium",
  "studente|donna|ambrata": "woman_student_medium_dark",
  "studente|donna|scura": "woman_student_dark",
  "informatico|uomo|chiara": "man_technologist_light",
  "informatico|uomo|chiara2": "man_technologist_medium_light",
  "informatico|uomo|media": "man_technologist_medium",
  "informatico|uomo|ambrata": "man_technologist_medium_dark",
  "informatico|uomo|scura": "man_technologist_dark",
  "informatico|donna|chiara": "woman_technologist_light",
  "informatico|donna|chiara2": "woman_technologist_medium_light",
  "informatico|donna|media": "woman_technologist_medium",
  "informatico|donna|ambrata": "woman_technologist_medium_dark",
  "informatico|donna|scura": "woman_technologist_dark",
  "artista|uomo|chiara": "man_artist_light",
  "artista|uomo|chiara2": "man_artist_medium_light",
  "artista|uomo|media": "man_artist_medium",
  "artista|uomo|ambrata": "man_artist_medium_dark",
  "artista|uomo|scura": "man_artist_dark",
  "artista|donna|chiara": "woman_artist_light",
  "artista|donna|chiara2": "woman_artist_medium_light",
  "artista|donna|media": "woman_artist_medium",
  "artista|donna|ambrata": "woman_artist_medium_dark",
  "artista|donna|scura": "woman_artist_dark",
  "cantante|uomo|chiara": "man_singer_light",
  "cantante|uomo|chiara2": "man_singer_medium_light",
  "cantante|uomo|media": "man_singer_medium",
  "cantante|uomo|ambrata": "man_singer_medium_dark",
  "cantante|uomo|scura": "man_singer_dark",
  "cantante|donna|chiara": "woman_singer_light",
  "cantante|donna|chiara2": "woman_singer_medium_light",
  "cantante|donna|media": "woman_singer_medium",
  "cantante|donna|ambrata": "woman_singer_medium_dark",
  "cantante|donna|scura": "woman_singer_dark",
  "guardia|uomo|chiara": "man_guard_light",
  "guardia|uomo|chiara2": "man_guard_medium_light",
  "guardia|uomo|media": "man_guard_medium",
  "guardia|uomo|ambrata": "man_guard_medium_dark",
  "guardia|uomo|scura": "man_guard_dark",
  "guardia|donna|chiara": "woman_guard_light",
  "guardia|donna|chiara2": "woman_guard_medium_light",
  "guardia|donna|media": "woman_guard_medium",
  "guardia|donna|ambrata": "woman_guard_medium_dark",
  "guardia|donna|scura": "woman_guard_dark",
  "detective|uomo|chiara": "man_detective_light",
  "detective|uomo|chiara2": "man_detective_medium_light",
  "detective|uomo|media": "man_detective_medium",
  "detective|uomo|ambrata": "man_detective_medium_dark",
  "detective|uomo|scura": "man_detective_dark",
  "detective|donna|chiara": "woman_detective_light",
  "detective|donna|chiara2": "woman_detective_medium_light",
  "detective|donna|media": "woman_detective_medium",
  "detective|donna|ambrata": "woman_detective_medium_dark",
  "detective|donna|scura": "woman_detective_dark",
  "turbante|uomo|chiara": "man_wearing_turban_light",
  "turbante|uomo|chiara2": "man_wearing_turban_medium_light",
  "turbante|uomo|media": "man_wearing_turban_medium",
  "turbante|uomo|ambrata": "man_wearing_turban_medium_dark",
  "turbante|uomo|scura": "man_wearing_turban_dark",
  "turbante|donna|chiara": "woman_wearing_turban_light",
  "turbante|donna|chiara2": "woman_wearing_turban_medium_light",
  "turbante|donna|media": "woman_wearing_turban_medium",
  "turbante|donna|ambrata": "woman_wearing_turban_medium_dark",
  "turbante|donna|scura": "woman_wearing_turban_dark",
  "supercattivo|uomo|chiara": "man_supervillain_light",
  "supercattivo|uomo|chiara2": "man_supervillain_medium_light",
  "supercattivo|uomo|media": "man_supervillain_medium",
  "supercattivo|uomo|ambrata": "man_supervillain_medium_dark",
  "supercattivo|uomo|scura": "man_supervillain_dark",
  "supercattivo|donna|chiara": "woman_supervillain_light",
  "supercattivo|donna|chiara2": "woman_supervillain_medium_light",
  "supercattivo|donna|media": "woman_supervillain_medium",
  "supercattivo|donna|ambrata": "woman_supervillain_medium_dark",
  "supercattivo|donna|scura": "woman_supervillain_dark",
  "mago|uomo|chiara": "man_mage_light",
  "mago|uomo|chiara2": "man_mage_medium_light",
  "mago|uomo|media": "man_mage_medium",
  "mago|uomo|ambrata": "man_mage_medium_dark",
  "mago|uomo|scura": "man_mage_dark",
  "mago|donna|chiara": "woman_mage_light",
  "mago|donna|chiara2": "woman_mage_medium_light",
  "mago|donna|media": "woman_mage_medium",
  "mago|donna|ambrata": "woman_mage_medium_dark",
  "mago|donna|scura": "woman_mage_dark",
  "fata|uomo|chiara": "man_fairy_light",
  "fata|uomo|chiara2": "man_fairy_medium_light",
  "fata|uomo|media": "man_fairy_medium",
  "fata|uomo|ambrata": "man_fairy_medium_dark",
  "fata|uomo|scura": "man_fairy_dark",
  "fata|donna|chiara": "woman_fairy_light",
  "fata|donna|chiara2": "woman_fairy_medium_light",
  "fata|donna|media": "woman_fairy_medium",
  "fata|donna|ambrata": "woman_fairy_medium_dark",
  "fata|donna|scura": "woman_fairy_dark",
  "vampiro|uomo|chiara": "man_vampire_light",
  "vampiro|uomo|chiara2": "man_vampire_medium_light",
  "vampiro|uomo|media": "man_vampire_medium",
  "vampiro|uomo|ambrata": "man_vampire_medium_dark",
  "vampiro|uomo|scura": "man_vampire_dark",
  "vampiro|donna|chiara": "woman_vampire_light",
  "vampiro|donna|chiara2": "woman_vampire_medium_light",
  "vampiro|donna|media": "woman_vampire_medium",
  "vampiro|donna|ambrata": "woman_vampire_medium_dark",
  "vampiro|donna|scura": "woman_vampire_dark",
  "elfo|uomo|chiara": "man_elf_light",
  "elfo|uomo|chiara2": "man_elf_medium_light",
  "elfo|uomo|media": "man_elf_medium",
  "elfo|uomo|ambrata": "man_elf_medium_dark",
  "elfo|uomo|scura": "man_elf_dark",
  "elfo|donna|chiara": "woman_elf_light",
  "elfo|donna|chiara2": "woman_elf_medium_light",
  "elfo|donna|media": "woman_elf_medium",
  "elfo|donna|ambrata": "woman_elf_medium_dark",
  "elfo|donna|scura": "woman_elf_dark",
  "casual|uomo|chiara": "man_tipping_hand_light",
  "casual|uomo|chiara2": "man_tipping_hand_medium_light",
  "casual|uomo|media": "man_tipping_hand_medium",
  "casual|uomo|ambrata": "man_tipping_hand_medium_dark",
  "casual|uomo|scura": "man_tipping_hand_dark",
  "casual|donna|chiara": "woman_tipping_hand_light",
  "casual|donna|chiara2": "woman_tipping_hand_medium_light",
  "casual|donna|media": "woman_tipping_hand_medium",
  "casual|donna|ambrata": "woman_tipping_hand_medium_dark",
  "casual|donna|scura": "woman_tipping_hand_dark",
  "saluto|uomo|chiara": "man_raising_hand_light",
  "saluto|uomo|chiara2": "man_raising_hand_medium_light",
  "saluto|uomo|media": "man_raising_hand_medium",
  "saluto|uomo|ambrata": "man_raising_hand_medium_dark",
  "saluto|uomo|scura": "man_raising_hand_dark",
  "saluto|donna|chiara": "woman_raising_hand_light",
  "saluto|donna|chiara2": "woman_raising_hand_medium_light",
  "saluto|donna|media": "woman_raising_hand_medium",
  "saluto|donna|ambrata": "woman_raising_hand_medium_dark",
  "saluto|donna|scura": "woman_raising_hand_dark",
  "attesa|donna|chiara": "pregnant_woman_light",
  "attesa|donna|chiara2": "pregnant_woman_medium_light",
  "attesa|donna|media": "pregnant_woman_medium",
  "attesa|donna|ambrata": "pregnant_woman_medium_dark",
  "attesa|donna|scura": "pregnant_woman_dark",
};
export const AVATAR_MISURE = {
  man_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 141 },
    occhi: [
      { cx: 61.9, cy: 99.9, w: 24, h: 14, pelle: [231, 173, 150] },
      { cx: 129, cy: 99.9, w: 24, h: 14, pelle: [255, 215, 187] },
    ],
  },
  man_medium_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 141 },
    occhi: [
      { cx: 62, cy: 99.9, w: 24, h: 14, pelle: [217, 158, 130] },
      { cx: 128.9, cy: 99.9, w: 24, h: 14, pelle: [244, 192, 155] },
    ],
  },
  man_medium: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 141 },
    occhi: [
      { cx: 61.7, cy: 100.3, w: 24, h: 15, pelle: [153, 115, 103] },
      { cx: 129, cy: 99.9, w: 24, h: 14, pelle: [194, 152, 126] },
    ],
  },
  man_medium_dark: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 141 },
    occhi: [
      { cx: 62, cy: 99.9, w: 24, h: 14, pelle: [130, 96, 89] },
      { cx: 129.2, cy: 100.2, w: 24, h: 15, pelle: [152, 111, 97] },
    ],
  },
  man_dark: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 141 },
    occhi: [
      { cx: 61.9, cy: 100.1, w: 24, h: 14, pelle: [80, 63, 61] },
      { cx: 129, cy: 100, w: 24, h: 14, pelle: [88, 63, 60] },
    ],
  },
  man_beard_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 141 },
    occhi: [
      { cx: 61.9, cy: 99.9, w: 24, h: 14, pelle: [87, 73, 67] },
      { cx: 129, cy: 99.9, w: 24, h: 14, pelle: [51, 51, 52] },
    ],
  },
  man_beard_medium_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 141 },
    occhi: [
      { cx: 62, cy: 99.9, w: 24, h: 14, pelle: [245, 200, 155] },
      { cx: 128.9, cy: 99.9, w: 24, h: 14, pelle: [255, 243, 186] },
    ],
  },
  man_beard_medium: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 141 },
    occhi: [
      { cx: 61.7, cy: 100.3, w: 24, h: 15, pelle: [92, 70, 67] },
      { cx: 129, cy: 99.9, w: 24, h: 14, pelle: [96, 70, 69] },
    ],
  },
  man_beard_medium_dark: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 141 },
    occhi: [
      { cx: 62, cy: 99.9, w: 24, h: 14, pelle: [70, 56, 54] },
      { cx: 129.2, cy: 100.2, w: 24, h: 15, pelle: [62, 50, 54] },
    ],
  },
  man_beard_dark: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 141 },
    occhi: [
      { cx: 61.9, cy: 100.1, w: 24, h: 14, pelle: [76, 67, 65] },
      { cx: 129, cy: 100, w: 24, h: 14, pelle: [58, 53, 55] },
    ],
  },
  man_curly_hair_light: {
    testa: { alto: 7, basso: 179, cx: 95.5, w: 129 },
    occhi: [
      { cx: 61.9, cy: 99.9, w: 24, h: 14, pelle: [232, 173, 150] },
      { cx: 129, cy: 99.9, w: 24, h: 14, pelle: [255, 215, 187] },
    ],
  },
  man_curly_hair_medium_light: {
    testa: { alto: 7, basso: 179, cx: 95.5, w: 129 },
    occhi: [
      { cx: 62, cy: 99.9, w: 24, h: 14, pelle: [217, 158, 131] },
      { cx: 128.9, cy: 99.9, w: 24, h: 14, pelle: [244, 192, 155] },
    ],
  },
  man_curly_hair_medium: {
    testa: { alto: 7, basso: 179, cx: 95.5, w: 129 },
    occhi: [
      { cx: 61.7, cy: 100.3, w: 24, h: 15, pelle: [153, 115, 103] },
      { cx: 129, cy: 99.9, w: 24, h: 14, pelle: [194, 152, 126] },
    ],
  },
  man_curly_hair_medium_dark: {
    testa: { alto: 7, basso: 179, cx: 95.5, w: 129 },
    occhi: [
      { cx: 62, cy: 99.9, w: 24, h: 14, pelle: [130, 96, 89] },
      { cx: 129.2, cy: 100.2, w: 24, h: 15, pelle: [152, 111, 97] },
    ],
  },
  man_curly_hair_dark: {
    testa: { alto: 7, basso: 179, cx: 95.5, w: 129 },
    occhi: [
      { cx: 61.9, cy: 100.1, w: 24, h: 14, pelle: [80, 63, 61] },
      { cx: 129, cy: 100, w: 24, h: 14, pelle: [88, 63, 60] },
    ],
  },
  man_red_hair_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 141 },
    occhi: [
      { cx: 61.9, cy: 99.9, w: 24, h: 14, pelle: [232, 173, 150] },
      { cx: 129, cy: 99.9, w: 24, h: 14, pelle: [255, 215, 187] },
    ],
  },
  man_red_hair_medium_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 141 },
    occhi: [
      { cx: 62, cy: 99.9, w: 24, h: 14, pelle: [217, 158, 130] },
      { cx: 128.9, cy: 99.9, w: 24, h: 14, pelle: [244, 192, 155] },
    ],
  },
  man_red_hair_medium: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 141 },
    occhi: [
      { cx: 61.7, cy: 100.3, w: 24, h: 15, pelle: [153, 115, 103] },
      { cx: 129, cy: 99.9, w: 24, h: 14, pelle: [194, 152, 126] },
    ],
  },
  man_red_hair_medium_dark: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 141 },
    occhi: [
      { cx: 62, cy: 99.9, w: 24, h: 14, pelle: [130, 96, 89] },
      { cx: 129.2, cy: 100.2, w: 24, h: 15, pelle: [152, 111, 97] },
    ],
  },
  man_red_hair_dark: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 141 },
    occhi: [
      { cx: 61.9, cy: 100.1, w: 24, h: 14, pelle: [80, 63, 61] },
      { cx: 129, cy: 100, w: 24, h: 14, pelle: [88, 63, 60] },
    ],
  },
  man_white_hair_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 141 },
    occhi: [
      { cx: 70.8, cy: 76.9, w: 24, h: 10, pelle: [215, 161, 144] },
      { cx: 126.8, cy: 77.7, w: 25, h: 13, pelle: [255, 215, 188] },
    ],
  },
  man_white_hair_medium_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 141 },
    occhi: [
      { cx: 70.8, cy: 76.9, w: 23, h: 10, pelle: [199, 143, 122] },
      { cx: 126.7, cy: 77.6, w: 25, h: 13, pelle: [244, 193, 156] },
    ],
  },
  man_white_hair_medium: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 141 },
    occhi: [
      { cx: 70.9, cy: 77, w: 22, h: 10, pelle: [143, 102, 97] },
      { cx: 127.2, cy: 77.7, w: 24, h: 13, pelle: [195, 153, 128] },
    ],
  },
  man_white_hair_medium_dark: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 141 },
    occhi: [
      { cx: 71.1, cy: 76.9, w: 22, h: 8, pelle: [113, 75, 74] },
      { cx: 127.3, cy: 77.8, w: 24, h: 12, pelle: [154, 112, 98] },
    ],
  },
  man_white_hair_dark: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 141 },
    occhi: [
      { cx: 71.3, cy: 76.9, w: 21, h: 8, pelle: [96, 80, 86] },
      { cx: 128.1, cy: 78.1, w: 23, h: 11, pelle: [89, 63, 61] },
    ],
  },
  man_blonde_hair_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 141 },
    occhi: [
      { cx: 61.9, cy: 99.9, w: 24, h: 14, pelle: [232, 173, 150] },
      { cx: 129, cy: 99.9, w: 24, h: 14, pelle: [255, 215, 187] },
    ],
  },
  man_blonde_hair_medium_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 141 },
    occhi: [
      { cx: 62, cy: 99.9, w: 24, h: 14, pelle: [217, 158, 130] },
      { cx: 128.9, cy: 99.9, w: 24, h: 14, pelle: [244, 192, 155] },
    ],
  },
  man_blonde_hair_medium: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 141 },
    occhi: [
      { cx: 61.7, cy: 100.3, w: 24, h: 15, pelle: [153, 115, 103] },
      { cx: 129, cy: 99.9, w: 24, h: 14, pelle: [194, 152, 126] },
    ],
  },
  man_blonde_hair_medium_dark: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 141 },
    occhi: [
      { cx: 62, cy: 99.9, w: 24, h: 14, pelle: [130, 96, 89] },
      { cx: 129.2, cy: 100.2, w: 24, h: 15, pelle: [152, 111, 97] },
    ],
  },
  man_blonde_hair_dark: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 141 },
    occhi: [
      { cx: 61.9, cy: 100.1, w: 24, h: 14, pelle: [80, 63, 61] },
      { cx: 129, cy: 100, w: 24, h: 14, pelle: [88, 63, 60] },
    ],
  },
  man_bald_light: {
    testa: { alto: 27, basso: 179, cx: 95.5, w: 135 },
    occhi: [
      { cx: 61.9, cy: 99.9, w: 24, h: 14, pelle: [232, 173, 150] },
      { cx: 129, cy: 99.9, w: 24, h: 14, pelle: [255, 215, 187] },
    ],
  },
  man_bald_medium_light: {
    testa: { alto: 27, basso: 179, cx: 95.5, w: 135 },
    occhi: [
      { cx: 62, cy: 99.9, w: 24, h: 14, pelle: [217, 158, 131] },
      { cx: 128.9, cy: 99.9, w: 24, h: 14, pelle: [244, 192, 155] },
    ],
  },
  man_bald_medium: {
    testa: { alto: 27, basso: 179, cx: 95.5, w: 135 },
    occhi: [
      { cx: 61.7, cy: 100.3, w: 24, h: 15, pelle: [153, 115, 103] },
      { cx: 129, cy: 99.9, w: 24, h: 14, pelle: [194, 152, 127] },
    ],
  },
  man_bald_medium_dark: {
    testa: { alto: 27, basso: 179, cx: 95.5, w: 135 },
    occhi: [
      { cx: 62, cy: 99.9, w: 24, h: 14, pelle: [130, 96, 89] },
      { cx: 129.2, cy: 100.2, w: 24, h: 15, pelle: [152, 111, 97] },
    ],
  },
  man_bald_dark: {
    testa: { alto: 27, basso: 179, cx: 95.5, w: 135 },
    occhi: [
      { cx: 61.9, cy: 100.1, w: 24, h: 14, pelle: [80, 63, 61] },
      { cx: 129, cy: 100, w: 24, h: 14, pelle: [88, 63, 60] },
    ],
  },
  woman_light: {
    testa: { alto: 12, basso: 179, cx: 95, w: 156 },
    occhi: [
      { cx: 65.7, cy: 100.8, w: 31, h: 15, pelle: [189, 130, 113] },
      { cx: 125.5, cy: 100.8, w: 31, h: 15, pelle: [245, 187, 161] },
    ],
  },
  woman_medium_light: {
    testa: { alto: 12, basso: 179, cx: 95, w: 156 },
    occhi: [
      { cx: 65.6, cy: 100.8, w: 31, h: 15, pelle: [176, 115, 92] },
      { cx: 125.7, cy: 100.6, w: 31, h: 15, pelle: [226, 166, 130] },
    ],
  },
  woman_medium: {
    testa: { alto: 12, basso: 179, cx: 95, w: 156 },
    occhi: [
      { cx: 65.6, cy: 100.8, w: 31, h: 15, pelle: [108, 71, 64] },
      { cx: 125.6, cy: 100.8, w: 31, h: 15, pelle: [171, 126, 101] },
    ],
  },
  woman_medium_dark: {
    testa: { alto: 12, basso: 179, cx: 95, w: 156 },
    occhi: [
      { cx: 65.7, cy: 100.8, w: 31, h: 15, pelle: [84, 48, 47] },
      { cx: 125.6, cy: 100.8, w: 31, h: 15, pelle: [126, 86, 74] },
    ],
  },
  woman_dark: {
    testa: { alto: 12, basso: 179, cx: 95, w: 156 },
    occhi: [
      { cx: 65.5, cy: 100.6, w: 31, h: 15, pelle: [35, 19, 20] },
      { cx: 125.8, cy: 100.7, w: 31, h: 15, pelle: [65, 40, 37] },
    ],
  },
  woman_beard_light: {
    testa: { alto: 12, basso: 179, cx: 95, w: 156 },
    occhi: [
      { cx: 61.9, cy: 100.2, w: 24, h: 15, pelle: [84, 70, 64] },
      { cx: 129, cy: 100.2, w: 24, h: 15, pelle: [50, 50, 50] },
    ],
  },
  woman_beard_medium_light: {
    testa: { alto: 12, basso: 179, cx: 95, w: 156 },
    occhi: [
      { cx: 62, cy: 100.1, w: 24, h: 14, pelle: [244, 198, 152] },
      { cx: 128.9, cy: 100, w: 24, h: 14, pelle: [255, 242, 186] },
    ],
  },
  woman_beard_medium: {
    testa: { alto: 12, basso: 179, cx: 95, w: 156 },
    occhi: [
      { cx: 61.6, cy: 100.6, w: 24, h: 15, pelle: [87, 66, 63] },
      { cx: 129.1, cy: 100.4, w: 24, h: 15, pelle: [90, 67, 66] },
    ],
  },
  woman_beard_medium_dark: {
    testa: { alto: 12, basso: 179, cx: 95, w: 156 },
    occhi: [
      { cx: 61.8, cy: 100.2, w: 24, h: 14, pelle: [72, 58, 55] },
      { cx: 129.3, cy: 100.6, w: 24, h: 15, pelle: [58, 46, 50] },
    ],
  },
  woman_beard_dark: {
    testa: { alto: 12, basso: 179, cx: 95, w: 156 },
    occhi: [
      { cx: 61.9, cy: 100.1, w: 24, h: 14, pelle: [73, 63, 60] },
      { cx: 129.1, cy: 100.1, w: 24, h: 14, pelle: [59, 53, 55] },
    ],
  },
  woman_curly_hair_light: {
    testa: { alto: 9, basso: 178, cx: 93.5, w: 161 },
    occhi: [
      { cx: 65.7, cy: 100.8, w: 31, h: 15, pelle: [183, 127, 111] },
      { cx: 125.6, cy: 100.8, w: 31, h: 15, pelle: [241, 185, 159] },
    ],
  },
  woman_curly_hair_medium_light: {
    testa: { alto: 9, basso: 178, cx: 93.5, w: 161 },
    occhi: [
      { cx: 65.6, cy: 100.8, w: 31, h: 15, pelle: [172, 113, 91] },
      { cx: 125.8, cy: 100.7, w: 31, h: 15, pelle: [222, 164, 129] },
    ],
  },
  woman_curly_hair_medium: {
    testa: { alto: 9, basso: 178, cx: 93.5, w: 161 },
    occhi: [
      { cx: 65.6, cy: 100.8, w: 31, h: 15, pelle: [107, 69, 63] },
      { cx: 125.6, cy: 100.8, w: 31, h: 15, pelle: [170, 124, 100] },
    ],
  },
  woman_curly_hair_medium_dark: {
    testa: { alto: 9, basso: 178, cx: 93.5, w: 161 },
    occhi: [
      { cx: 65.7, cy: 100.8, w: 31, h: 15, pelle: [81, 47, 46] },
      { cx: 125.6, cy: 100.8, w: 31, h: 15, pelle: [125, 85, 73] },
    ],
  },
  woman_curly_hair_dark: {
    testa: { alto: 9, basso: 178, cx: 93.5, w: 161 },
    occhi: [
      { cx: 65.5, cy: 100.6, w: 31, h: 15, pelle: [34, 19, 19] },
      { cx: 125.8, cy: 100.7, w: 31, h: 15, pelle: [64, 39, 37] },
    ],
  },
  woman_red_hair_light: {
    testa: { alto: 12, basso: 179, cx: 95, w: 156 },
    occhi: [
      { cx: 65.6, cy: 100.8, w: 31, h: 15, pelle: [194, 131, 114] },
      { cx: 125.5, cy: 100.8, w: 31, h: 15, pelle: [250, 188, 162] },
    ],
  },
  woman_red_hair_medium_light: {
    testa: { alto: 12, basso: 179, cx: 95, w: 156 },
    occhi: [
      { cx: 65.6, cy: 100.8, w: 31, h: 15, pelle: [175, 113, 92] },
      { cx: 125.7, cy: 100.6, w: 31, h: 15, pelle: [225, 165, 130] },
    ],
  },
  woman_red_hair_medium: {
    testa: { alto: 12, basso: 179, cx: 95, w: 156 },
    occhi: [
      { cx: 65.6, cy: 100.8, w: 31, h: 15, pelle: [110, 71, 64] },
      { cx: 125.6, cy: 100.8, w: 31, h: 15, pelle: [172, 126, 101] },
    ],
  },
  woman_red_hair_medium_dark: {
    testa: { alto: 12, basso: 179, cx: 95, w: 156 },
    occhi: [
      { cx: 65.7, cy: 100.8, w: 31, h: 15, pelle: [87, 48, 47] },
      { cx: 125.6, cy: 100.8, w: 31, h: 15, pelle: [128, 86, 74] },
    ],
  },
  woman_red_hair_dark: {
    testa: { alto: 12, basso: 179, cx: 95, w: 156 },
    occhi: [
      { cx: 65.5, cy: 100.6, w: 31, h: 15, pelle: [36, 19, 20] },
      { cx: 125.8, cy: 100.7, w: 31, h: 15, pelle: [65, 40, 37] },
    ],
  },
  woman_white_hair_light: {
    testa: { alto: 12, basso: 179, cx: 95, w: 156 },
    occhi: [
      { cx: 65.6, cy: 100.8, w: 31, h: 15, pelle: [195, 133, 116] },
      { cx: 125.5, cy: 100.8, w: 31, h: 15, pelle: [251, 190, 163] },
    ],
  },
  woman_white_hair_medium_light: {
    testa: { alto: 12, basso: 179, cx: 95, w: 156 },
    occhi: [
      { cx: 65.6, cy: 100.8, w: 31, h: 15, pelle: [176, 114, 93] },
      { cx: 125.7, cy: 100.6, w: 31, h: 15, pelle: [226, 166, 131] },
    ],
  },
  woman_white_hair_medium: {
    testa: { alto: 12, basso: 179, cx: 95, w: 156 },
    occhi: [
      { cx: 65.6, cy: 100.8, w: 31, h: 15, pelle: [110, 72, 65] },
      { cx: 125.6, cy: 100.8, w: 31, h: 15, pelle: [172, 126, 102] },
    ],
  },
  woman_white_hair_medium_dark: {
    testa: { alto: 12, basso: 179, cx: 95, w: 156 },
    occhi: [
      { cx: 65.7, cy: 100.8, w: 31, h: 15, pelle: [87, 48, 47] },
      { cx: 125.6, cy: 100.8, w: 31, h: 15, pelle: [128, 86, 74] },
    ],
  },
  woman_white_hair_dark: {
    testa: { alto: 12, basso: 179, cx: 95, w: 156 },
    occhi: [
      { cx: 65.5, cy: 100.6, w: 31, h: 15, pelle: [36, 20, 20] },
      { cx: 125.8, cy: 100.7, w: 31, h: 15, pelle: [65, 40, 38] },
    ],
  },
  woman_blonde_hair_light: {
    testa: { alto: 12, basso: 179, cx: 95, w: 156 },
    occhi: [
      { cx: 65.6, cy: 100.8, w: 31, h: 15, pelle: [198, 133, 115] },
      { cx: 125.5, cy: 100.8, w: 31, h: 15, pelle: [253, 190, 162] },
    ],
  },
  woman_blonde_hair_medium_light: {
    testa: { alto: 12, basso: 179, cx: 95, w: 156 },
    occhi: [
      { cx: 65.6, cy: 100.8, w: 31, h: 15, pelle: [178, 115, 92] },
      { cx: 125.7, cy: 100.6, w: 31, h: 15, pelle: [227, 166, 130] },
    ],
  },
  woman_blonde_hair_medium: {
    testa: { alto: 12, basso: 179, cx: 95, w: 156 },
    occhi: [
      { cx: 65.6, cy: 100.8, w: 31, h: 15, pelle: [111, 72, 65] },
      { cx: 125.6, cy: 100.8, w: 31, h: 15, pelle: [172, 126, 101] },
    ],
  },
  woman_blonde_hair_medium_dark: {
    testa: { alto: 12, basso: 179, cx: 95, w: 156 },
    occhi: [
      { cx: 65.7, cy: 100.8, w: 31, h: 15, pelle: [88, 48, 47] },
      { cx: 125.6, cy: 100.8, w: 31, h: 15, pelle: [129, 86, 74] },
    ],
  },
  woman_blonde_hair_dark: {
    testa: { alto: 12, basso: 179, cx: 95, w: 156 },
    occhi: [
      { cx: 65.5, cy: 100.6, w: 31, h: 15, pelle: [36, 20, 20] },
      { cx: 125.8, cy: 100.7, w: 31, h: 15, pelle: [65, 40, 38] },
    ],
  },
  woman_bald_light: {
    testa: { alto: 28, basso: 174, cx: 95.5, w: 129 },
    occhi: [
      { cx: 65.6, cy: 100.8, w: 31, h: 15, pelle: [201, 137, 117] },
      { cx: 125.5, cy: 100.8, w: 31, h: 15, pelle: [250, 190, 163] },
    ],
  },
  woman_bald_medium_light: {
    testa: { alto: 28, basso: 174, cx: 95.5, w: 129 },
    occhi: [
      { cx: 65.6, cy: 100.8, w: 31, h: 15, pelle: [180, 117, 93] },
      { cx: 125.7, cy: 100.6, w: 31, h: 15, pelle: [225, 166, 130] },
    ],
  },
  woman_bald_medium: {
    testa: { alto: 28, basso: 174, cx: 95.5, w: 129 },
    occhi: [
      { cx: 65.6, cy: 100.8, w: 31, h: 15, pelle: [111, 73, 66] },
      { cx: 125.6, cy: 100.8, w: 31, h: 15, pelle: [172, 126, 102] },
    ],
  },
  woman_bald_medium_dark: {
    testa: { alto: 28, basso: 174, cx: 95.5, w: 129 },
    occhi: [
      { cx: 65.7, cy: 100.8, w: 31, h: 15, pelle: [89, 49, 48] },
      { cx: 125.6, cy: 100.8, w: 31, h: 15, pelle: [129, 87, 74] },
    ],
  },
  woman_bald_dark: {
    testa: { alto: 28, basso: 174, cx: 95.5, w: 129 },
    occhi: [
      { cx: 65.5, cy: 100.6, w: 31, h: 15, pelle: [36, 20, 21] },
      { cx: 125.8, cy: 100.7, w: 31, h: 15, pelle: [65, 41, 38] },
    ],
  },
  person_light: {
    testa: { alto: 13, basso: 179, cx: 96, w: 144 },
    occhi: [
      { cx: 61.9, cy: 99.9, w: 24, h: 14, pelle: [234, 175, 153] },
      { cx: 129.2, cy: 100, w: 24, h: 14, pelle: [255, 211, 183] },
    ],
  },
  person_medium_light: {
    testa: { alto: 13, basso: 179, cx: 96, w: 144 },
    occhi: [
      { cx: 62, cy: 99.9, w: 24, h: 14, pelle: [219, 160, 134] },
      { cx: 129, cy: 99.9, w: 24, h: 14, pelle: [243, 191, 154] },
    ],
  },
  person_medium: {
    testa: { alto: 13, basso: 179, cx: 96, w: 144 },
    occhi: [
      { cx: 65.5, cy: 100.6, w: 31, h: 15, pelle: [108, 71, 62] },
      { cx: 129.2, cy: 100, w: 24, h: 14, pelle: [191, 149, 124] },
    ],
  },
  person_medium_dark: {
    testa: { alto: 13, basso: 179, cx: 96, w: 144 },
    occhi: [
      { cx: 61.9, cy: 99.9, w: 24, h: 14, pelle: [129, 94, 87] },
      { cx: 125.7, cy: 100.6, w: 31, h: 15, pelle: [127, 87, 74] },
    ],
  },
  person_dark: {
    testa: { alto: 13, basso: 179, cx: 96, w: 144 },
    occhi: [
      { cx: 61.9, cy: 100.1, w: 24, h: 14, pelle: [76, 57, 55] },
      { cx: 129.1, cy: 100, w: 24, h: 14, pelle: [86, 61, 58] },
    ],
  },
  person_beard_light: {
    testa: { alto: 12, basso: 179, cx: 96, w: 144 },
    occhi: [
      { cx: 65.2, cy: 100.2, w: 31, h: 15, pelle: [94, 79, 73] },
      { cx: 125.3, cy: 100.3, w: 31, h: 15, pelle: [113, 94, 86] },
    ],
  },
  person_beard_medium_light: {
    testa: { alto: 12, basso: 179, cx: 96, w: 144 },
    occhi: [
      { cx: 64.9, cy: 100.2, w: 31, h: 15, pelle: [250, 202, 158] },
      { cx: 125.5, cy: 100.2, w: 31, h: 15, pelle: [248, 215, 164] },
    ],
  },
  person_beard_medium: {
    testa: { alto: 12, basso: 179, cx: 96, w: 144 },
    occhi: [
      { cx: 65.3, cy: 100.2, w: 31, h: 15, pelle: [94, 72, 68] },
      { cx: 128.7, cy: 99.6, w: 26, h: 15, pelle: [96, 72, 70] },
    ],
  },
  person_beard_medium_dark: {
    testa: { alto: 12, basso: 179, cx: 96, w: 144 },
    occhi: [
      { cx: 65.3, cy: 100.2, w: 31, h: 15, pelle: [75, 61, 58] },
      { cx: 128.7, cy: 99.6, w: 26, h: 15, pelle: [63, 51, 55] },
    ],
  },
  person_beard_dark: {
    testa: { alto: 12, basso: 179, cx: 96, w: 144 },
    occhi: [
      { cx: 64.9, cy: 100.3, w: 31, h: 15, pelle: [68, 60, 59] },
      { cx: 128.8, cy: 99.7, w: 26, h: 15, pelle: [65, 61, 62] },
    ],
  },
  person_curly_hair_light: {
    testa: { alto: 8, basso: 179, cx: 94, w: 168 },
    occhi: [
      { cx: 61.8, cy: 100, w: 24, h: 14, pelle: [229, 170, 148] },
      { cx: 129.2, cy: 100, w: 24, h: 14, pelle: [255, 210, 183] },
    ],
  },
  person_curly_hair_medium_light: {
    testa: { alto: 8, basso: 179, cx: 94, w: 168 },
    occhi: [
      { cx: 62, cy: 99.9, w: 24, h: 14, pelle: [219, 159, 133] },
      { cx: 129, cy: 99.9, w: 24, h: 14, pelle: [243, 191, 154] },
    ],
  },
  person_curly_hair_medium: {
    testa: { alto: 8, basso: 179, cx: 94, w: 168 },
    occhi: [
      { cx: 65.4, cy: 100.6, w: 31, h: 15, pelle: [105, 67, 60] },
      { cx: 129.3, cy: 100, w: 24, h: 14, pelle: [191, 149, 123] },
    ],
  },
  person_curly_hair_medium_dark: {
    testa: { alto: 8, basso: 179, cx: 94, w: 168 },
    occhi: [
      { cx: 61.8, cy: 100, w: 24, h: 14, pelle: [125, 89, 83] },
      { cx: 129.4, cy: 100.3, w: 24, h: 15, pelle: [150, 108, 94] },
    ],
  },
  person_curly_hair_dark: {
    testa: { alto: 8, basso: 179, cx: 94, w: 168 },
    occhi: [
      { cx: 61.8, cy: 100.1, w: 24, h: 14, pelle: [75, 57, 54] },
      { cx: 129.1, cy: 100, w: 24, h: 14, pelle: [86, 61, 57] },
    ],
  },
  person_red_hair_light: {
    testa: { alto: 13, basso: 179, cx: 96, w: 144 },
    occhi: [
      { cx: 61.9, cy: 99.9, w: 24, h: 14, pelle: [234, 176, 153] },
      { cx: 129.2, cy: 100, w: 24, h: 14, pelle: [255, 211, 184] },
    ],
  },
  person_red_hair_medium_light: {
    testa: { alto: 13, basso: 179, cx: 96, w: 144 },
    occhi: [
      { cx: 62, cy: 99.9, w: 24, h: 14, pelle: [220, 160, 134] },
      { cx: 129, cy: 99.9, w: 24, h: 14, pelle: [243, 191, 154] },
    ],
  },
  person_red_hair_medium: {
    testa: { alto: 13, basso: 179, cx: 96, w: 144 },
    occhi: [
      { cx: 65.5, cy: 100.6, w: 31, h: 15, pelle: [109, 71, 62] },
      { cx: 129.2, cy: 100, w: 24, h: 14, pelle: [191, 149, 124] },
    ],
  },
  person_red_hair_medium_dark: {
    testa: { alto: 13, basso: 179, cx: 96, w: 144 },
    occhi: [
      { cx: 61.9, cy: 99.9, w: 24, h: 14, pelle: [129, 94, 87] },
      { cx: 125.7, cy: 100.6, w: 31, h: 15, pelle: [129, 87, 74] },
    ],
  },
  person_red_hair_dark: {
    testa: { alto: 13, basso: 179, cx: 96, w: 144 },
    occhi: [
      { cx: 62, cy: 100.1, w: 24, h: 14, pelle: [82, 64, 61] },
      { cx: 129.1, cy: 100, w: 24, h: 14, pelle: [86, 61, 57] },
    ],
  },
  person_white_hair_light: {
    testa: { alto: 13, basso: 179, cx: 96, w: 144 },
    occhi: [
      { cx: 61.9, cy: 99.9, w: 24, h: 14, pelle: [234, 175, 153] },
      { cx: 129.2, cy: 100, w: 24, h: 14, pelle: [255, 211, 184] },
    ],
  },
  person_white_hair_medium_light: {
    testa: { alto: 13, basso: 179, cx: 96, w: 144 },
    occhi: [
      { cx: 62, cy: 99.9, w: 24, h: 14, pelle: [219, 160, 134] },
      { cx: 129, cy: 99.9, w: 24, h: 14, pelle: [243, 191, 154] },
    ],
  },
  person_white_hair_medium: {
    testa: { alto: 13, basso: 179, cx: 96, w: 144 },
    occhi: [
      { cx: 65.5, cy: 100.6, w: 31, h: 15, pelle: [109, 72, 63] },
      { cx: 129.2, cy: 100, w: 24, h: 14, pelle: [191, 150, 124] },
    ],
  },
  person_white_hair_medium_dark: {
    testa: { alto: 13, basso: 179, cx: 96, w: 144 },
    occhi: [
      { cx: 61.9, cy: 99.9, w: 24, h: 14, pelle: [129, 94, 87] },
      { cx: 125.7, cy: 100.6, w: 31, h: 15, pelle: [129, 87, 74] },
    ],
  },
  person_white_hair_dark: {
    testa: { alto: 13, basso: 179, cx: 96, w: 144 },
    occhi: [
      { cx: 61.9, cy: 100.1, w: 24, h: 14, pelle: [76, 57, 55] },
      { cx: 129.1, cy: 100, w: 24, h: 14, pelle: [87, 61, 58] },
    ],
  },
  person_blonde_hair_light: {
    testa: { alto: 13, basso: 179, cx: 96, w: 144 },
    occhi: [
      { cx: 61.9, cy: 99.9, w: 24, h: 14, pelle: [234, 175, 153] },
      { cx: 129.2, cy: 100, w: 24, h: 14, pelle: [255, 211, 184] },
    ],
  },
  person_blonde_hair_medium_light: {
    testa: { alto: 13, basso: 179, cx: 96, w: 144 },
    occhi: [
      { cx: 62, cy: 99.9, w: 24, h: 14, pelle: [219, 160, 134] },
      { cx: 129, cy: 99.9, w: 24, h: 14, pelle: [243, 191, 154] },
    ],
  },
  person_blonde_hair_medium: {
    testa: { alto: 13, basso: 179, cx: 96, w: 144 },
    occhi: [
      { cx: 65.5, cy: 100.6, w: 31, h: 15, pelle: [110, 72, 62] },
      { cx: 129.2, cy: 100, w: 24, h: 14, pelle: [191, 150, 124] },
    ],
  },
  person_blonde_hair_medium_dark: {
    testa: { alto: 13, basso: 179, cx: 96, w: 144 },
    occhi: [
      { cx: 61.9, cy: 99.9, w: 24, h: 14, pelle: [129, 94, 87] },
      { cx: 125.7, cy: 100.6, w: 31, h: 15, pelle: [130, 87, 74] },
    ],
  },
  person_blonde_hair_dark: {
    testa: { alto: 13, basso: 179, cx: 96, w: 144 },
    occhi: [
      { cx: 61.9, cy: 100.1, w: 24, h: 14, pelle: [76, 57, 55] },
      { cx: 129.1, cy: 100, w: 24, h: 14, pelle: [87, 61, 58] },
    ],
  },
  person_bald_light: {
    testa: { alto: 24, basso: 179, cx: 95.5, w: 129 },
    occhi: [
      { cx: 61.9, cy: 99.9, w: 24, h: 14, pelle: [234, 176, 153] },
      { cx: 129.2, cy: 100, w: 24, h: 14, pelle: [255, 211, 183] },
    ],
  },
  person_bald_medium_light: {
    testa: { alto: 24, basso: 179, cx: 95.5, w: 129 },
    occhi: [
      { cx: 62, cy: 99.9, w: 24, h: 14, pelle: [219, 160, 134] },
      { cx: 128.9, cy: 99.9, w: 24, h: 14, pelle: [243, 191, 154] },
    ],
  },
  person_bald_medium: {
    testa: { alto: 24, basso: 179, cx: 95.5, w: 129 },
    occhi: [
      { cx: 65.5, cy: 100.6, w: 31, h: 15, pelle: [109, 72, 63] },
      { cx: 129.2, cy: 100, w: 24, h: 14, pelle: [191, 150, 124] },
    ],
  },
  person_bald_medium_dark: {
    testa: { alto: 24, basso: 179, cx: 95.5, w: 129 },
    occhi: [
      { cx: 61.9, cy: 99.9, w: 24, h: 14, pelle: [129, 95, 87] },
      { cx: 125.7, cy: 100.6, w: 31, h: 15, pelle: [128, 87, 74] },
    ],
  },
  person_bald_dark: {
    testa: { alto: 24, basso: 179, cx: 95.5, w: 129 },
    occhi: [
      { cx: 62, cy: 100.1, w: 24, h: 14, pelle: [83, 64, 61] },
      { cx: 129.1, cy: 100, w: 24, h: 14, pelle: [86, 61, 58] },
    ],
  },
  boy_light: {
    testa: { alto: 12, basso: 179, cx: 100, w: 144 },
    occhi: [
      { cx: 62.3, cy: 102.2, w: 36, h: 18, pelle: [204, 137, 135] },
      { cx: 128.8, cy: 102.2, w: 36, h: 18, pelle: [214, 159, 150] },
    ],
  },
  boy_medium_light: {
    testa: { alto: 12, basso: 179, cx: 100, w: 144 },
    occhi: [
      { cx: 62.4, cy: 102.2, w: 36, h: 18, pelle: [189, 119, 122] },
      { cx: 128.8, cy: 102.2, w: 36, h: 18, pelle: [197, 137, 132] },
    ],
  },
  boy_medium: {
    testa: { alto: 12, basso: 179, cx: 100, w: 144 },
    occhi: [
      { cx: 62.4, cy: 102.1, w: 37, h: 18, pelle: [142, 88, 116] },
      { cx: 128.9, cy: 102.2, w: 36, h: 18, pelle: [154, 100, 118] },
    ],
  },
  boy_medium_dark: {
    testa: { alto: 12, basso: 179, cx: 100, w: 144 },
    occhi: [
      { cx: 62.4, cy: 102.1, w: 36, h: 18, pelle: [111, 61, 91] },
      { cx: 128.7, cy: 102.2, w: 37, h: 18, pelle: [127, 81, 104] },
    ],
  },
  boy_dark: {
    testa: { alto: 12, basso: 179, cx: 100, w: 144 },
    occhi: [
      { cx: 62.3, cy: 102.2, w: 36, h: 18, pelle: [58, 36, 55] },
      { cx: 128.8, cy: 102.3, w: 36, h: 18, pelle: [65, 42, 58] },
    ],
  },
  girl_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 143 },
    occhi: [
      { cx: 62.3, cy: 102.2, w: 36, h: 18, pelle: [196, 134, 122] },
      { cx: 128.8, cy: 102.2, w: 36, h: 18, pelle: [208, 155, 140] },
    ],
  },
  girl_medium_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 143 },
    occhi: [
      { cx: 62.4, cy: 102.2, w: 36, h: 18, pelle: [197, 127, 111] },
      { cx: 128.8, cy: 102.2, w: 36, h: 18, pelle: [215, 151, 126] },
    ],
  },
  girl_medium: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 143 },
    occhi: [
      { cx: 62.4, cy: 102.1, w: 37, h: 18, pelle: [131, 83, 104] },
      { cx: 128.9, cy: 102.2, w: 36, h: 18, pelle: [142, 96, 102] },
    ],
  },
  girl_medium_dark: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 143 },
    occhi: [
      { cx: 62.4, cy: 102.1, w: 36, h: 18, pelle: [99, 57, 76] },
      { cx: 128.7, cy: 102.2, w: 37, h: 18, pelle: [119, 78, 97] },
    ],
  },
  girl_dark: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 143 },
    occhi: [
      { cx: 62.3, cy: 102.2, w: 36, h: 18, pelle: [51, 31, 45] },
      { cx: 128.8, cy: 102.3, w: 36, h: 18, pelle: [60, 39, 49] },
    ],
  },
  old_man_light: {
    testa: { alto: 27, basso: 179, cx: 95.5, w: 135 },
    occhi: [
      { cx: 61.9, cy: 99.9, w: 24, h: 14, pelle: [232, 173, 150] },
      { cx: 129, cy: 99.9, w: 24, h: 14, pelle: [255, 215, 187] },
    ],
  },
  old_man_medium_light: {
    testa: { alto: 27, basso: 179, cx: 95.5, w: 135 },
    occhi: [
      { cx: 62, cy: 99.9, w: 24, h: 14, pelle: [217, 158, 130] },
      { cx: 128.9, cy: 99.9, w: 24, h: 14, pelle: [244, 192, 155] },
    ],
  },
  old_man_medium: {
    testa: { alto: 27, basso: 179, cx: 95.5, w: 135 },
    occhi: [
      { cx: 61.7, cy: 100.3, w: 24, h: 15, pelle: [153, 115, 103] },
      { cx: 129, cy: 99.9, w: 24, h: 14, pelle: [194, 152, 126] },
    ],
  },
  old_man_medium_dark: {
    testa: { alto: 27, basso: 179, cx: 95.5, w: 135 },
    occhi: [
      { cx: 62, cy: 99.9, w: 24, h: 14, pelle: [130, 96, 89] },
      { cx: 129.2, cy: 100.2, w: 24, h: 15, pelle: [152, 111, 97] },
    ],
  },
  old_man_dark: {
    testa: { alto: 27, basso: 179, cx: 95.5, w: 135 },
    occhi: [
      { cx: 61.9, cy: 100.1, w: 24, h: 14, pelle: [80, 63, 61] },
      { cx: 129, cy: 100, w: 24, h: 14, pelle: [88, 63, 60] },
    ],
  },
  old_woman_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 131 },
    occhi: [
      { cx: 61.4, cy: 106.9, w: 24, h: 14, pelle: [221, 161, 138] },
      { cx: 129.6, cy: 107, w: 24, h: 14, pelle: [254, 208, 180] },
    ],
  },
  old_woman_medium_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 131 },
    occhi: [
      { cx: 61.4, cy: 106.9, w: 24, h: 14, pelle: [205, 144, 117] },
      { cx: 129.6, cy: 107, w: 24, h: 14, pelle: [238, 185, 148] },
    ],
  },
  old_woman_medium: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 131 },
    occhi: [
      { cx: 61, cy: 107, w: 22, h: 14, pelle: [152, 111, 99] },
      { cx: 129.6, cy: 107, w: 24, h: 14, pelle: [188, 145, 119] },
    ],
  },
  old_woman_medium_dark: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 131 },
    occhi: [
      { cx: 61, cy: 107, w: 22, h: 14, pelle: [125, 89, 81] },
      { cx: 130, cy: 107.1, w: 23, h: 14, pelle: [145, 102, 87] },
    ],
  },
  old_woman_dark: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 131 },
    occhi: [
      { cx: 61, cy: 107, w: 22, h: 14, pelle: [74, 55, 52] },
      { cx: 130, cy: 107.1, w: 22, h: 14, pelle: [83, 55, 52] },
    ],
  },
  man_office_worker_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 77 },
    occhi: [
      { cx: 77.2, cy: 59.3, w: 10, h: 8, pelle: [228, 170, 150] },
      { cx: 113.9, cy: 59.4, w: 10, h: 8, pelle: [255, 218, 190] },
    ],
  },
  man_office_worker_medium_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 77 },
    occhi: [
      { cx: 77.1, cy: 59.4, w: 10, h: 8, pelle: [214, 155, 129] },
      { cx: 113.9, cy: 59.4, w: 10, h: 8, pelle: [250, 195, 157] },
    ],
  },
  man_office_worker_medium: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 77 },
    occhi: [
      { cx: 77.1, cy: 59.4, w: 11, h: 8, pelle: [154, 114, 102] },
      { cx: 113.8, cy: 59.3, w: 10, h: 8, pelle: [198, 153, 127] },
    ],
  },
  man_office_worker_medium_dark: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 77 },
    occhi: [
      { cx: 77.1, cy: 59.4, w: 10, h: 8, pelle: [127, 90, 83] },
      { cx: 113.9, cy: 59.4, w: 11, h: 8, pelle: [153, 109, 95] },
    ],
  },
  man_office_worker_dark: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 77 },
    occhi: [
      { cx: 76.9, cy: 59.6, w: 9, h: 8, pelle: [79, 60, 57] },
      { cx: 114.1, cy: 59.5, w: 9, h: 8, pelle: [84, 54, 51] },
    ],
  },
  woman_office_worker_light: {
    testa: { alto: 14, basso: 177, cx: 95.5, w: 91 },
    occhi: [
      { cx: 76.6, cy: 62, w: 8, h: 7, pelle: [227, 170, 150] },
      { cx: 114.5, cy: 62, w: 8, h: 7, pelle: [255, 218, 191] },
    ],
  },
  woman_office_worker_medium_light: {
    testa: { alto: 14, basso: 177, cx: 95.5, w: 91 },
    occhi: [
      { cx: 76.6, cy: 62, w: 8, h: 7, pelle: [213, 155, 130] },
      { cx: 114.5, cy: 62, w: 8, h: 7, pelle: [250, 195, 158] },
    ],
  },
  woman_office_worker_medium: {
    testa: { alto: 14, basso: 177, cx: 95.5, w: 91 },
    occhi: [
      { cx: 76.6, cy: 62, w: 8, h: 7, pelle: [150, 110, 99] },
      { cx: 114.5, cy: 62, w: 8, h: 7, pelle: [198, 153, 127] },
    ],
  },
  woman_office_worker_medium_dark: {
    testa: { alto: 14, basso: 177, cx: 95.5, w: 91 },
    occhi: [
      { cx: 76.6, cy: 62, w: 8, h: 7, pelle: [124, 86, 81] },
      { cx: 114.5, cy: 62, w: 8, h: 7, pelle: [153, 108, 94] },
    ],
  },
  woman_office_worker_dark: {
    testa: { alto: 14, basso: 177, cx: 95.5, w: 91 },
    occhi: [
      { cx: 76.6, cy: 62, w: 8, h: 7, pelle: [74, 55, 52] },
      { cx: 114.5, cy: 62, w: 8, h: 7, pelle: [83, 54, 50] },
    ],
  },
  man_health_worker_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 77 },
    occhi: [
      { cx: 86.5, cy: 128.4, w: 15, h: 42, pelle: [213, 201, 229] },
      { cx: 105.5, cy: 134.7, w: 12, h: 23, pelle: [200, 193, 220] },
    ],
  },
  man_health_worker_medium_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 77 },
    occhi: [
      { cx: 44.8, cy: 141.8, w: 28, h: 75, pelle: [0, 0, 0] },
      { cx: 138.8, cy: 138.6, w: 43, h: 82, pelle: [0, 0, 0] },
    ],
  },
  man_health_worker_medium: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 77 },
    occhi: [
      { cx: 39.8, cy: 142.2, w: 21, h: 62, pelle: [0, 0, 0] },
      { cx: 140.5, cy: 135, w: 42, h: 82, pelle: [0, 0, 0] },
    ],
  },
  man_health_worker_medium_dark: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 77 },
    occhi: [
      { cx: 39.7, cy: 142.3, w: 21, h: 62, pelle: [0, 0, 0] },
      { cx: 140.5, cy: 135, w: 42, h: 82, pelle: [0, 0, 0] },
    ],
  },
  man_health_worker_dark: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 77 },
    occhi: [
      { cx: 87, cy: 129.9, w: 15, h: 40, pelle: [208, 198, 227] },
      { cx: 105.5, cy: 135.8, w: 9, h: 14, pelle: [63, 118, 187] },
    ],
  },
  woman_health_worker_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 91 },
    occhi: [
      { cx: 85.2, cy: 125.1, w: 16, h: 49, pelle: [0, 0, 0] },
      { cx: 105.5, cy: 134.3, w: 12, h: 22, pelle: [127, 164, 217] },
    ],
  },
  woman_health_worker_medium_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 91 },
    occhi: [
      { cx: 44.7, cy: 141.7, w: 28, h: 75, pelle: [0, 0, 0] },
      { cx: 138.8, cy: 138.6, w: 44, h: 83, pelle: [0, 0, 0] },
    ],
  },
  woman_health_worker_medium: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 91 },
    occhi: [
      { cx: 39.8, cy: 142.3, w: 21, h: 61, pelle: [0, 0, 0] },
      { cx: 140.5, cy: 135, w: 43, h: 82, pelle: [0, 0, 0] },
    ],
  },
  woman_health_worker_medium_dark: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 91 },
    occhi: [
      { cx: 39.8, cy: 142.3, w: 21, h: 61, pelle: [0, 0, 0] },
      { cx: 140.5, cy: 135, w: 43, h: 82, pelle: [0, 0, 0] },
    ],
  },
  woman_health_worker_dark: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 91 },
    occhi: [
      { cx: 77.2, cy: 59.7, w: 11, h: 7, pelle: [82, 63, 59] },
      { cx: 113.8, cy: 59.7, w: 11, h: 7, pelle: [85, 56, 53] },
    ],
  },
  man_cook_light: {
    testa: { alto: 12, basso: 179, cx: 96, w: 88 },
    occhi: [
      { cx: 77.7, cy: 59.3, w: 12, h: 8, pelle: [230, 172, 149] },
      { cx: 113.5, cy: 59.5, w: 12, h: 8, pelle: [255, 215, 186] },
    ],
  },
  man_cook_medium_light: {
    testa: { alto: 12, basso: 179, cx: 96, w: 88 },
    occhi: [
      { cx: 77.6, cy: 59.4, w: 12, h: 8, pelle: [215, 157, 129] },
      { cx: 113.8, cy: 59.6, w: 11, h: 8, pelle: [247, 193, 154] },
    ],
  },
  man_cook_medium: {
    testa: { alto: 12, basso: 179, cx: 96, w: 88 },
    occhi: [
      { cx: 70.4, cy: 133.3, w: 8, h: 10, pelle: [189, 175, 202] },
      { cx: 132.6, cy: 127.9, w: 37, h: 49, pelle: [0, 0, 0] },
    ],
  },
  man_cook_medium_dark: {
    testa: { alto: 12, basso: 179, cx: 96, w: 88 },
    occhi: [
      { cx: 70.7, cy: 133.6, w: 8, h: 10, pelle: [189, 174, 202] },
      { cx: 132.3, cy: 127.5, w: 37, h: 48, pelle: [0, 0, 0] },
    ],
  },
  man_cook_dark: {
    testa: { alto: 12, basso: 179, cx: 96, w: 88 },
    occhi: [
      { cx: 77.2, cy: 59.7, w: 11, h: 7, pelle: [82, 63, 59] },
      { cx: 113.8, cy: 59.6, w: 11, h: 8, pelle: [85, 56, 53] },
    ],
  },
  woman_cook_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 91 },
    occhi: [
      { cx: 77.6, cy: 59.5, w: 12, h: 8, pelle: [231, 173, 150] },
      { cx: 113.3, cy: 59.4, w: 12, h: 8, pelle: [255, 214, 186] },
    ],
  },
  woman_cook_medium_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 91 },
    occhi: [
      { cx: 77.6, cy: 59.5, w: 12, h: 8, pelle: [217, 159, 131] },
      { cx: 113.3, cy: 59.4, w: 12, h: 8, pelle: [245, 192, 154] },
    ],
  },
  woman_cook_medium: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 91 },
    occhi: [
      { cx: 70.3, cy: 133.2, w: 8, h: 12, pelle: [189, 175, 203] },
      { cx: 132.4, cy: 127.6, w: 38, h: 49, pelle: [0, 0, 0] },
    ],
  },
  woman_cook_medium_dark: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 91 },
    occhi: [
      { cx: 70.3, cy: 133.3, w: 9, h: 11, pelle: [186, 172, 200] },
      { cx: 132.2, cy: 127.4, w: 38, h: 48, pelle: [0, 0, 0] },
    ],
  },
  woman_cook_dark: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 91 },
    occhi: [
      { cx: 77.2, cy: 59.7, w: 11, h: 7, pelle: [81, 63, 59] },
      { cx: 113.8, cy: 59.7, w: 11, h: 7, pelle: [85, 56, 53] },
    ],
  },
  man_in_tuxedo_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 77 },
    occhi: [
      { cx: 77.7, cy: 59.3, w: 12, h: 8, pelle: [232, 174, 152] },
      { cx: 113.5, cy: 59.5, w: 12, h: 8, pelle: [255, 215, 187] },
    ],
  },
  man_in_tuxedo_medium_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 77 },
    occhi: [
      { cx: 77.7, cy: 59.3, w: 12, h: 8, pelle: [217, 159, 133] },
      { cx: 113.8, cy: 59.6, w: 11, h: 8, pelle: [246, 193, 156] },
    ],
  },
  man_in_tuxedo_medium: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 77 },
    occhi: [
      { cx: 77.5, cy: 59.3, w: 13, h: 8, pelle: [149, 113, 100] },
      { cx: 113.3, cy: 59.3, w: 12, h: 8, pelle: [194, 153, 126] },
    ],
  },
  man_in_tuxedo_medium_dark: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 77 },
    occhi: [
      { cx: 77.6, cy: 59.4, w: 12, h: 8, pelle: [128, 94, 86] },
      { cx: 113.4, cy: 59.4, w: 13, h: 8, pelle: [152, 110, 95] },
    ],
  },
  man_in_tuxedo_dark: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 77 },
    occhi: [
      { cx: 77.2, cy: 59.7, w: 11, h: 7, pelle: [82, 64, 60] },
      { cx: 113.8, cy: 59.6, w: 11, h: 8, pelle: [85, 57, 55] },
    ],
  },
  woman_in_tuxedo_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 91 },
    occhi: [
      { cx: 77.6, cy: 59.5, w: 12, h: 8, pelle: [230, 173, 151] },
      { cx: 113.3, cy: 59.4, w: 12, h: 8, pelle: [255, 214, 187] },
    ],
  },
  woman_in_tuxedo_medium_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 91 },
    occhi: [
      { cx: 77.6, cy: 59.5, w: 12, h: 8, pelle: [217, 159, 132] },
      { cx: 113.3, cy: 59.4, w: 12, h: 8, pelle: [245, 192, 155] },
    ],
  },
  woman_in_tuxedo_medium: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 91 },
    occhi: [
      { cx: 77.5, cy: 59.6, w: 12, h: 7, pelle: [152, 113, 101] },
      { cx: 113.4, cy: 59.5, w: 12, h: 8, pelle: [194, 151, 125] },
    ],
  },
  woman_in_tuxedo_medium_dark: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 91 },
    occhi: [
      { cx: 77.2, cy: 59.7, w: 11, h: 7, pelle: [128, 92, 85] },
      { cx: 113.7, cy: 59.7, w: 13, h: 7, pelle: [147, 106, 91] },
    ],
  },
  woman_in_tuxedo_dark: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 91 },
    occhi: [
      { cx: 77.2, cy: 59.7, w: 11, h: 7, pelle: [82, 64, 59] },
      { cx: 113.8, cy: 59.7, w: 11, h: 7, pelle: [85, 56, 53] },
    ],
  },
  man_with_veil_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 129 },
    occhi: [
      { cx: 77.7, cy: 59.3, w: 12, h: 8, pelle: [231, 172, 149] },
      { cx: 113.5, cy: 59.5, w: 12, h: 8, pelle: [255, 215, 187] },
    ],
  },
  man_with_veil_medium_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 129 },
    occhi: [
      { cx: 77.6, cy: 59.4, w: 12, h: 8, pelle: [216, 157, 129] },
      { cx: 113.5, cy: 59.5, w: 12, h: 8, pelle: [245, 192, 155] },
    ],
  },
  man_with_veil_medium: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 129 },
    occhi: [
      { cx: 77.5, cy: 59.3, w: 13, h: 8, pelle: [150, 113, 100] },
      { cx: 113.3, cy: 59.3, w: 12, h: 8, pelle: [195, 153, 126] },
    ],
  },
  man_with_veil_medium_dark: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 129 },
    occhi: [
      { cx: 77.6, cy: 59.4, w: 12, h: 8, pelle: [128, 93, 86] },
      { cx: 113.3, cy: 59.3, w: 12, h: 8, pelle: [153, 110, 95] },
    ],
  },
  man_with_veil_dark: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 129 },
    occhi: [
      { cx: 77.2, cy: 59.7, w: 11, h: 7, pelle: [82, 64, 59] },
      { cx: 113.8, cy: 59.6, w: 11, h: 8, pelle: [85, 57, 54] },
    ],
  },
  woman_with_veil_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 129 },
    occhi: [
      { cx: 77.7, cy: 59.4, w: 12, h: 8, pelle: [232, 174, 152] },
      { cx: 113.4, cy: 59.4, w: 12, h: 8, pelle: [255, 212, 186] },
    ],
  },
  woman_with_veil_medium_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 129 },
    occhi: [
      { cx: 77.7, cy: 59.4, w: 12, h: 8, pelle: [219, 160, 133] },
      { cx: 113.4, cy: 59.4, w: 12, h: 8, pelle: [243, 191, 154] },
    ],
  },
  woman_with_veil_medium: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 129 },
    occhi: [
      { cx: 77.6, cy: 59.5, w: 12, h: 8, pelle: [153, 113, 100] },
      { cx: 113.4, cy: 59.4, w: 12, h: 8, pelle: [194, 151, 125] },
    ],
  },
  woman_with_veil_medium_dark: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 129 },
    occhi: [
      { cx: 77.4, cy: 59.6, w: 11, h: 8, pelle: [128, 92, 85] },
      { cx: 113.5, cy: 59.5, w: 12, h: 8, pelle: [151, 108, 94] },
    ],
  },
  woman_with_veil_dark: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 129 },
    occhi: [
      { cx: 77.2, cy: 59.7, w: 11, h: 7, pelle: [81, 63, 59] },
      { cx: 113.9, cy: 59.7, w: 11, h: 7, pelle: [85, 56, 53] },
    ],
  },
  man_firefighter_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 103 },
    occhi: [
      { cx: 77.7, cy: 59.3, w: 12, h: 8, pelle: [227, 167, 146] },
      { cx: 113.4, cy: 59.4, w: 12, h: 8, pelle: [255, 209, 183] },
    ],
  },
  man_firefighter_medium_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 103 },
    occhi: [
      { cx: 77.7, cy: 59.3, w: 12, h: 8, pelle: [213, 153, 126] },
      { cx: 113.5, cy: 59.5, w: 12, h: 8, pelle: [242, 188, 152] },
    ],
  },
  man_firefighter_medium: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 103 },
    occhi: [
      { cx: 77.7, cy: 59.3, w: 12, h: 8, pelle: [152, 111, 99] },
      { cx: 113.3, cy: 59.3, w: 12, h: 8, pelle: [194, 148, 123] },
    ],
  },
  man_firefighter_medium_dark: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 103 },
    occhi: [
      { cx: 77.6, cy: 59.4, w: 12, h: 8, pelle: [127, 91, 84] },
      { cx: 113.3, cy: 59.3, w: 12, h: 8, pelle: [151, 107, 93] },
    ],
  },
  man_firefighter_dark: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 103 },
    occhi: [
      { cx: 77.2, cy: 59.7, w: 11, h: 7, pelle: [81, 63, 59] },
      { cx: 113.9, cy: 59.7, w: 11, h: 7, pelle: [84, 56, 53] },
    ],
  },
  woman_firefighter_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 103 },
    occhi: [
      { cx: 77.6, cy: 59.5, w: 12, h: 8, pelle: [227, 169, 148] },
      { cx: 113.4, cy: 59.5, w: 12, h: 8, pelle: [255, 206, 181] },
    ],
  },
  woman_firefighter_medium_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 103 },
    occhi: [
      { cx: 77.6, cy: 59.5, w: 12, h: 8, pelle: [214, 155, 129] },
      { cx: 113.4, cy: 59.5, w: 12, h: 8, pelle: [239, 186, 151] },
    ],
  },
  woman_firefighter_medium: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 103 },
    occhi: [
      { cx: 76.8, cy: 59.9, w: 9, h: 7, pelle: [150, 109, 99] },
      { cx: 113.5, cy: 59.6, w: 12, h: 7, pelle: [193, 148, 122] },
    ],
  },
  woman_firefighter_medium_dark: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 103 },
    occhi: [
      { cx: 76.8, cy: 59.9, w: 9, h: 7, pelle: [125, 88, 81] },
      { cx: 113.5, cy: 59.6, w: 12, h: 7, pelle: [149, 105, 91] },
    ],
  },
  woman_firefighter_dark: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 103 },
    occhi: [
      { cx: 76.8, cy: 59.9, w: 9, h: 7, pelle: [78, 59, 56] },
      { cx: 113.8, cy: 59.7, w: 11, h: 7, pelle: [84, 56, 52] },
    ],
  },
  man_police_officer_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 99 },
    occhi: [
      { cx: 74.5, cy: 71.8, w: 13, h: 9, pelle: [229, 172, 150] },
      { cx: 116.5, cy: 71.9, w: 11, h: 9, pelle: [255, 216, 189] },
    ],
  },
  man_police_officer_medium_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 99 },
    occhi: [
      { cx: 74.5, cy: 71.8, w: 13, h: 9, pelle: [215, 157, 129] },
      { cx: 116.5, cy: 71.9, w: 11, h: 9, pelle: [246, 193, 156] },
    ],
  },
  man_police_officer_medium: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 99 },
    occhi: [
      { cx: 74.3, cy: 71.9, w: 12, h: 9, pelle: [153, 113, 102] },
      { cx: 116.5, cy: 71.8, w: 13, h: 9, pelle: [194, 152, 126] },
    ],
  },
  man_police_officer_medium_dark: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 99 },
    occhi: [
      { cx: 74.4, cy: 71.9, w: 11, h: 9, pelle: [127, 91, 84] },
      { cx: 116.7, cy: 71.9, w: 12, h: 9, pelle: [153, 109, 94] },
    ],
  },
  man_police_officer_dark: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 99 },
    occhi: [
      { cx: 74.4, cy: 72, w: 11, h: 9, pelle: [80, 61, 57] },
      { cx: 116.5, cy: 71.9, w: 11, h: 9, pelle: [84, 55, 51] },
    ],
  },
  woman_police_officer_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 103 },
    occhi: [
      { cx: 74.4, cy: 71.9, w: 13, h: 9, pelle: [228, 170, 149] },
      { cx: 116.6, cy: 71.9, w: 13, h: 9, pelle: [255, 211, 185] },
    ],
  },
  woman_police_officer_medium_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 103 },
    occhi: [
      { cx: 74.4, cy: 71.9, w: 13, h: 9, pelle: [214, 156, 129] },
      { cx: 116.5, cy: 71.9, w: 12, h: 9, pelle: [243, 191, 155] },
    ],
  },
  woman_police_officer_medium: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 103 },
    occhi: [
      { cx: 74.4, cy: 71.9, w: 13, h: 9, pelle: [150, 110, 97] },
      { cx: 116.6, cy: 71.9, w: 13, h: 9, pelle: [193, 150, 124] },
    ],
  },
  woman_police_officer_medium_dark: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 103 },
    occhi: [
      { cx: 74.3, cy: 71.9, w: 11, h: 9, pelle: [127, 91, 85] },
      { cx: 116.8, cy: 72.1, w: 12, h: 9, pelle: [151, 108, 94] },
    ],
  },
  woman_police_officer_dark: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 103 },
    occhi: [
      { cx: 74.3, cy: 71.9, w: 11, h: 9, pelle: [81, 62, 58] },
      { cx: 116.7, cy: 72, w: 11, h: 9, pelle: [84, 56, 53] },
    ],
  },
  man_construction_worker_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 89 },
    occhi: [
      { cx: 75.8, cy: 78.5, w: 11, h: 8, pelle: [232, 171, 149] },
      { cx: 115.5, cy: 78.6, w: 10, h: 8, pelle: [255, 215, 188] },
    ],
  },
  man_construction_worker_medium_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 89 },
    occhi: [
      { cx: 75.8, cy: 78.5, w: 11, h: 8, pelle: [217, 156, 129] },
      { cx: 115.5, cy: 78.6, w: 10, h: 8, pelle: [248, 193, 156] },
    ],
  },
  man_construction_worker_medium: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 89 },
    occhi: [
      { cx: 75.6, cy: 78.8, w: 11, h: 9, pelle: [155, 113, 102] },
      { cx: 115.3, cy: 78.4, w: 11, h: 8, pelle: [197, 152, 126] },
    ],
  },
  man_construction_worker_medium_dark: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 89 },
    occhi: [
      { cx: 75.7, cy: 78.5, w: 11, h: 8, pelle: [129, 92, 85] },
      { cx: 115.5, cy: 78.9, w: 11, h: 9, pelle: [153, 108, 94] },
    ],
  },
  man_construction_worker_dark: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 89 },
    occhi: [
      { cx: 75.5, cy: 78.6, w: 10, h: 8, pelle: [80, 61, 57] },
      { cx: 115.5, cy: 78.6, w: 10, h: 8, pelle: [84, 55, 52] },
    ],
  },
  woman_construction_worker_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 101 },
    occhi: [
      { cx: 74.6, cy: 79.7, w: 13, h: 9, pelle: [233, 173, 151] },
      { cx: 116.4, cy: 79.7, w: 13, h: 9, pelle: [255, 212, 186] },
    ],
  },
  woman_construction_worker_medium_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 101 },
    occhi: [
      { cx: 74.6, cy: 79.7, w: 13, h: 9, pelle: [219, 158, 132] },
      { cx: 116.4, cy: 79.6, w: 13, h: 9, pelle: [244, 190, 154] },
    ],
  },
  woman_construction_worker_medium: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 101 },
    occhi: [
      { cx: 74.3, cy: 79.8, w: 12, h: 9, pelle: [154, 113, 101] },
      { cx: 116.4, cy: 79.6, w: 13, h: 9, pelle: [195, 151, 125] },
    ],
  },
  woman_construction_worker_medium_dark: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 101 },
    occhi: [
      { cx: 74.3, cy: 79.8, w: 12, h: 9, pelle: [128, 91, 84] },
      { cx: 116.6, cy: 79.7, w: 12, h: 9, pelle: [152, 108, 93] },
    ],
  },
  woman_construction_worker_dark: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 101 },
    occhi: [
      { cx: 74.4, cy: 79.7, w: 12, h: 9, pelle: [80, 62, 58] },
      { cx: 116.6, cy: 79.7, w: 12, h: 9, pelle: [85, 57, 54] },
    ],
  },
  man_factory_worker_light: {
    testa: { alto: 12, basso: 179, cx: 103, w: 132 },
    occhi: [
      { cx: 71, cy: 59.4, w: 12, h: 8, pelle: [225, 165, 148] },
      { cx: 107, cy: 59.4, w: 12, h: 8, pelle: [226, 180, 162] },
    ],
  },
  man_factory_worker_medium_light: {
    testa: { alto: 12, basso: 179, cx: 103, w: 132 },
    occhi: [
      { cx: 70.9, cy: 59.5, w: 12, h: 8, pelle: [211, 151, 128] },
      { cx: 107.1, cy: 59.5, w: 12, h: 8, pelle: [209, 161, 135] },
    ],
  },
  man_factory_worker_medium: {
    testa: { alto: 12, basso: 179, cx: 103, w: 132 },
    occhi: [
      { cx: 70.9, cy: 59.2, w: 12, h: 8, pelle: [148, 109, 100] },
      { cx: 106.9, cy: 59.3, w: 12, h: 8, pelle: [161, 123, 107] },
    ],
  },
  man_factory_worker_medium_dark: {
    testa: { alto: 12, basso: 179, cx: 103, w: 132 },
    occhi: [
      { cx: 70.9, cy: 59.5, w: 12, h: 8, pelle: [125, 90, 85] },
      { cx: 107.1, cy: 59.5, w: 12, h: 8, pelle: [128, 91, 82] },
    ],
  },
  man_factory_worker_dark: {
    testa: { alto: 12, basso: 179, cx: 103, w: 132 },
    occhi: [
      { cx: 70.8, cy: 59.7, w: 12, h: 7, pelle: [80, 63, 60] },
      { cx: 107.2, cy: 59.7, w: 12, h: 7, pelle: [69, 48, 47] },
    ],
  },
  woman_factory_worker_light: {
    testa: { alto: 12, basso: 179, cx: 103, w: 132 },
    occhi: [
      { cx: 70.9, cy: 59.5, w: 12, h: 8, pelle: [227, 168, 151] },
      { cx: 107.2, cy: 59.6, w: 12, h: 8, pelle: [224, 180, 161] },
    ],
  },
  woman_factory_worker_medium_light: {
    testa: { alto: 12, basso: 179, cx: 103, w: 132 },
    occhi: [
      { cx: 70.9, cy: 59.5, w: 12, h: 8, pelle: [213, 154, 132] },
      { cx: 107.2, cy: 59.6, w: 12, h: 8, pelle: [208, 161, 135] },
    ],
  },
  woman_factory_worker_medium: {
    testa: { alto: 12, basso: 179, cx: 103, w: 132 },
    occhi: [
      { cx: 70.9, cy: 59.5, w: 12, h: 8, pelle: [149, 109, 100] },
      { cx: 107.4, cy: 59.7, w: 12, h: 7, pelle: [158, 121, 105] },
    ],
  },
  woman_factory_worker_medium_dark: {
    testa: { alto: 12, basso: 179, cx: 103, w: 132 },
    occhi: [
      { cx: 70.8, cy: 59.7, w: 12, h: 7, pelle: [124, 89, 84] },
      { cx: 107.2, cy: 59.7, w: 12, h: 7, pelle: [124, 88, 79] },
    ],
  },
  woman_factory_worker_dark: {
    testa: { alto: 12, basso: 179, cx: 103, w: 132 },
    occhi: [
      { cx: 70.8, cy: 59.7, w: 12, h: 7, pelle: [80, 62, 59] },
      { cx: 107.2, cy: 59.7, w: 12, h: 7, pelle: [69, 47, 46] },
    ],
  },
  man_mechanic_light: {
    testa: { alto: 12, basso: 179, cx: 92.5, w: 77 },
    occhi: [
      { cx: 82.2, cy: 116.5, w: 13, h: 10, pelle: [236, 209, 254] },
      { cx: 113.8, cy: 109.5, w: 20, h: 26, pelle: [64, 144, 232] },
    ],
  },
  man_mechanic_medium_light: {
    testa: { alto: 12, basso: 179, cx: 92.5, w: 77 },
    occhi: [
      { cx: 70.8, cy: 107.7, w: 6, h: 18, pelle: [210, 194, 232] },
      { cx: 113.9, cy: 109.4, w: 20, h: 26, pelle: [63, 143, 232] },
    ],
  },
  man_mechanic_medium: {
    testa: { alto: 12, basso: 179, cx: 92.5, w: 77 },
    occhi: [
      { cx: 70.4, cy: 108.2, w: 4, h: 14, pelle: [204, 190, 227] },
      { cx: 113.6, cy: 109, w: 23, h: 26, pelle: [66, 149, 234] },
    ],
  },
  man_mechanic_medium_dark: {
    testa: { alto: 12, basso: 179, cx: 92.5, w: 77 },
    occhi: [
      { cx: 70.5, cy: 108.6, w: 4, h: 13, pelle: [204, 190, 226] },
      { cx: 113.8, cy: 108.9, w: 22, h: 26, pelle: [64, 144, 232] },
    ],
  },
  man_mechanic_dark: {
    testa: { alto: 12, basso: 179, cx: 92.5, w: 77 },
    occhi: [
      { cx: 71.2, cy: 108.6, w: 6, h: 12, pelle: [200, 188, 223] },
      { cx: 113.2, cy: 108.8, w: 24, h: 24, pelle: [68, 155, 236] },
    ],
  },
  woman_mechanic_light: {
    testa: { alto: 12, basso: 179, cx: 92.5, w: 89 },
    occhi: [
      { cx: 78.5, cy: 110.8, w: 23, h: 24, pelle: [55, 147, 240] },
      { cx: 112.1, cy: 108.5, w: 25, h: 28, pelle: [68, 148, 233] },
    ],
  },
  woman_mechanic_medium_light: {
    testa: { alto: 12, basso: 179, cx: 92.5, w: 89 },
    occhi: [
      { cx: 78.5, cy: 110.6, w: 23, h: 24, pelle: [55, 147, 240] },
      { cx: 112.3, cy: 108.2, w: 26, h: 28, pelle: [70, 152, 234] },
    ],
  },
  woman_mechanic_medium: {
    testa: { alto: 12, basso: 179, cx: 92.5, w: 89 },
    occhi: [
      { cx: 79.1, cy: 110.4, w: 24, h: 21, pelle: [54, 149, 241] },
      { cx: 111.5, cy: 107.5, w: 26, h: 28, pelle: [69, 151, 233] },
    ],
  },
  woman_mechanic_medium_dark: {
    testa: { alto: 12, basso: 179, cx: 92.5, w: 89 },
    occhi: [
      { cx: 79.1, cy: 110.5, w: 23, h: 20, pelle: [55, 151, 243] },
      { cx: 111.6, cy: 107.4, w: 26, h: 28, pelle: [69, 150, 234] },
    ],
  },
  woman_mechanic_dark: {
    testa: { alto: 12, basso: 179, cx: 92.5, w: 89 },
    occhi: [
      { cx: 79.1, cy: 110.6, w: 23, h: 20, pelle: [55, 151, 243] },
      { cx: 112, cy: 107.7, w: 25, h: 28, pelle: [66, 147, 232] },
    ],
  },
  man_farmer_light: {
    testa: { alto: 12, basso: 179, cx: 105, w: 140 },
    occhi: [
      { cx: 77.2, cy: 59.2, w: 11, h: 8, pelle: [230, 173, 151] },
      { cx: 113.8, cy: 59.2, w: 11, h: 8, pelle: [255, 212, 184] },
    ],
  },
  man_farmer_medium_light: {
    testa: { alto: 12, basso: 179, cx: 105, w: 140 },
    occhi: [
      { cx: 137.8, cy: 87.4, w: 6, h: 37, pelle: [63, 158, 225] },
      { cx: 173, cy: 93.7, w: 4, h: 46, pelle: [0, 0, 0] },
    ],
  },
  man_farmer_medium: {
    testa: { alto: 12, basso: 179, cx: 105, w: 140 },
    occhi: [
      { cx: 138.1, cy: 88.2, w: 7, h: 39, pelle: [61, 147, 221] },
      { cx: 172.8, cy: 91.9, w: 5, h: 46, pelle: [0, 0, 0] },
    ],
  },
  man_farmer_medium_dark: {
    testa: { alto: 12, basso: 179, cx: 105, w: 140 },
    occhi: [
      { cx: 138.1, cy: 88.2, w: 7, h: 39, pelle: [60, 147, 220] },
      { cx: 172.8, cy: 91.9, w: 5, h: 46, pelle: [0, 0, 0] },
    ],
  },
  man_farmer_dark: {
    testa: { alto: 12, basso: 179, cx: 105, w: 140 },
    occhi: [
      { cx: 77.2, cy: 59.3, w: 11, h: 8, pelle: [81, 64, 59] },
      { cx: 113.8, cy: 59.3, w: 11, h: 8, pelle: [84, 56, 53] },
    ],
  },
  woman_farmer_light: {
    testa: { alto: 12, basso: 179, cx: 105, w: 140 },
    occhi: [
      { cx: 77.9, cy: 59.6, w: 12, h: 8, pelle: [228, 172, 150] },
      { cx: 113.1, cy: 59.5, w: 12, h: 8, pelle: [255, 212, 184] },
    ],
  },
  woman_farmer_medium_light: {
    testa: { alto: 12, basso: 179, cx: 105, w: 140 },
    occhi: [
      { cx: 137.8, cy: 86.9, w: 6, h: 38, pelle: [64, 158, 224] },
      { cx: 173, cy: 93.7, w: 4, h: 46, pelle: [0, 0, 0] },
    ],
  },
  woman_farmer_medium: {
    testa: { alto: 12, basso: 179, cx: 105, w: 140 },
    occhi: [
      { cx: 138.1, cy: 88.2, w: 7, h: 39, pelle: [61, 148, 221] },
      { cx: 172.8, cy: 91.9, w: 5, h: 46, pelle: [0, 0, 0] },
    ],
  },
  woman_farmer_medium_dark: {
    testa: { alto: 12, basso: 179, cx: 105, w: 140 },
    occhi: [
      { cx: 138.1, cy: 88.2, w: 7, h: 39, pelle: [61, 147, 220] },
      { cx: 172.8, cy: 91.9, w: 5, h: 46, pelle: [0, 0, 0] },
    ],
  },
  woman_farmer_dark: {
    testa: { alto: 12, basso: 179, cx: 105, w: 140 },
    occhi: [
      { cx: 77.5, cy: 59.9, w: 11, h: 7, pelle: [78, 59, 56] },
      { cx: 113.6, cy: 59.8, w: 11, h: 7, pelle: [83, 55, 51] },
    ],
  },
  man_pilot_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 79 },
    occhi: [
      { cx: 77.1, cy: 59.5, w: 9, h: 8, pelle: [228, 169, 151] },
      { cx: 113.4, cy: 59.4, w: 12, h: 8, pelle: [255, 215, 189] },
    ],
  },
  man_pilot_medium_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 79 },
    occhi: [
      { cx: 77.1, cy: 59.5, w: 9, h: 8, pelle: [214, 154, 129] },
      { cx: 113.4, cy: 59.4, w: 12, h: 8, pelle: [246, 192, 156] },
    ],
  },
  man_pilot_medium: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 79 },
    occhi: [
      { cx: 76.9, cy: 59.6, w: 9, h: 8, pelle: [153, 111, 101] },
      { cx: 113.2, cy: 59.2, w: 12, h: 8, pelle: [196, 153, 127] },
    ],
  },
  man_pilot_medium_dark: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 79 },
    occhi: [
      { cx: 76.8, cy: 59.7, w: 9, h: 8, pelle: [127, 90, 84] },
      { cx: 113.4, cy: 59.4, w: 13, h: 8, pelle: [153, 110, 96] },
    ],
  },
  man_pilot_dark: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 79 },
    occhi: [
      { cx: 76.6, cy: 60, w: 8, h: 7, pelle: [74, 54, 53] },
      { cx: 113.9, cy: 59.7, w: 11, h: 7, pelle: [85, 56, 54] },
    ],
  },
  woman_pilot_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 91 },
    occhi: [
      { cx: 87.8, cy: 113.4, w: 13, h: 12, pelle: [96, 85, 135] },
      { cx: 102.3, cy: 110.6, w: 6, h: 10, pelle: [146, 132, 159] },
    ],
  },
  woman_pilot_medium_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 91 },
    occhi: [
      { cx: 87.4, cy: 113.8, w: 12, h: 11, pelle: [96, 85, 134] },
      { cx: 102.5, cy: 110.6, w: 5, h: 9, pelle: [150, 135, 165] },
    ],
  },
  woman_pilot_medium: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 91 },
    occhi: [
      { cx: 76.8, cy: 59.9, w: 9, h: 7, pelle: [152, 111, 101] },
      { cx: 113.6, cy: 59.6, w: 12, h: 7, pelle: [195, 151, 126] },
    ],
  },
  woman_pilot_medium_dark: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 91 },
    occhi: [
      { cx: 76.6, cy: 60, w: 8, h: 7, pelle: [122, 85, 81] },
      { cx: 114, cy: 59.8, w: 12, h: 7, pelle: [151, 108, 94] },
    ],
  },
  woman_pilot_dark: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 91 },
    occhi: [
      { cx: 76.8, cy: 59.9, w: 9, h: 7, pelle: [79, 60, 56] },
      { cx: 113.8, cy: 59.7, w: 11, h: 7, pelle: [85, 56, 54] },
    ],
  },
  man_astronaut_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 119 },
    occhi: [
      { cx: 47.2, cy: 143, w: 31, h: 36, pelle: [0, 0, 0] },
      { cx: 127.6, cy: 141, w: 108, h: 75, pelle: [0, 0, 0] },
    ],
  },
  man_astronaut_medium_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 119 },
    occhi: [
      { cx: 47.3, cy: 143.1, w: 31, h: 36, pelle: [0, 0, 0] },
      { cx: 127.6, cy: 141, w: 108, h: 75, pelle: [0, 0, 0] },
    ],
  },
  man_astronaut_medium: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 119 },
    occhi: [
      { cx: 47.2, cy: 143.1, w: 31, h: 36, pelle: [0, 0, 0] },
      { cx: 127.6, cy: 141, w: 108, h: 75, pelle: [0, 0, 0] },
    ],
  },
  man_astronaut_medium_dark: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 119 },
    occhi: [
      { cx: 47.2, cy: 143, w: 31, h: 36, pelle: [0, 0, 0] },
      { cx: 127.6, cy: 141.1, w: 108, h: 75, pelle: [0, 0, 0] },
    ],
  },
  man_astronaut_dark: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 119 },
    occhi: [
      { cx: 47.3, cy: 142.8, w: 31, h: 38, pelle: [0, 0, 0] },
      { cx: 127.6, cy: 141, w: 108, h: 75, pelle: [0, 0, 0] },
    ],
  },
  woman_astronaut_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 119 },
    occhi: [
      { cx: 47.2, cy: 143, w: 31, h: 36, pelle: [0, 0, 0] },
      { cx: 127.7, cy: 141.2, w: 108, h: 75, pelle: [0, 0, 0] },
    ],
  },
  woman_astronaut_medium_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 119 },
    occhi: [
      { cx: 47.2, cy: 143.1, w: 31, h: 36, pelle: [0, 0, 0] },
      { cx: 127.8, cy: 141.2, w: 108, h: 75, pelle: [0, 0, 0] },
    ],
  },
  woman_astronaut_medium: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 119 },
    occhi: [
      { cx: 47.2, cy: 143.1, w: 31, h: 36, pelle: [0, 0, 0] },
      { cx: 127.8, cy: 141.1, w: 108, h: 75, pelle: [0, 0, 0] },
    ],
  },
  woman_astronaut_medium_dark: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 119 },
    occhi: [
      { cx: 47.2, cy: 143.1, w: 31, h: 36, pelle: [0, 0, 0] },
      { cx: 127.7, cy: 141.1, w: 108, h: 75, pelle: [0, 0, 0] },
    ],
  },
  woman_astronaut_dark: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 119 },
    occhi: [
      { cx: 47.2, cy: 142.8, w: 31, h: 38, pelle: [0, 0, 0] },
      { cx: 127.7, cy: 141.1, w: 108, h: 75, pelle: [0, 0, 0] },
    ],
  },
  man_judge_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 77 },
    occhi: [
      { cx: 77.7, cy: 59.3, w: 12, h: 8, pelle: [230, 172, 149] },
      { cx: 113.5, cy: 59.5, w: 12, h: 8, pelle: [255, 214, 185] },
    ],
  },
  man_judge_medium_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 77 },
    occhi: [
      { cx: 77.6, cy: 59.4, w: 12, h: 8, pelle: [215, 157, 129] },
      { cx: 113.8, cy: 59.6, w: 11, h: 8, pelle: [245, 192, 153] },
    ],
  },
  man_judge_medium: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 77 },
    occhi: [
      { cx: 77.5, cy: 59.3, w: 13, h: 8, pelle: [149, 113, 99] },
      { cx: 113.3, cy: 59.3, w: 12, h: 8, pelle: [193, 152, 124] },
    ],
  },
  man_judge_medium_dark: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 77 },
    occhi: [
      { cx: 77.6, cy: 59.4, w: 12, h: 8, pelle: [128, 94, 86] },
      { cx: 113.3, cy: 59.3, w: 12, h: 8, pelle: [151, 110, 94] },
    ],
  },
  man_judge_dark: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 77 },
    occhi: [
      { cx: 77.2, cy: 59.7, w: 11, h: 7, pelle: [82, 64, 59] },
      { cx: 113.8, cy: 59.6, w: 11, h: 8, pelle: [85, 56, 53] },
    ],
  },
  woman_judge_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 91 },
    occhi: [
      { cx: 77.7, cy: 59.4, w: 12, h: 8, pelle: [232, 174, 152] },
      { cx: 113.3, cy: 59.4, w: 12, h: 8, pelle: [255, 213, 185] },
    ],
  },
  woman_judge_medium_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 91 },
    occhi: [
      { cx: 77.6, cy: 59.5, w: 12, h: 8, pelle: [217, 159, 131] },
      { cx: 113.3, cy: 59.4, w: 12, h: 8, pelle: [243, 191, 153] },
    ],
  },
  woman_judge_medium: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 91 },
    occhi: [
      { cx: 77.5, cy: 59.6, w: 12, h: 7, pelle: [152, 113, 100] },
      { cx: 113.4, cy: 59.5, w: 12, h: 8, pelle: [192, 151, 123] },
    ],
  },
  woman_judge_medium_dark: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 91 },
    occhi: [
      { cx: 77.2, cy: 59.7, w: 11, h: 7, pelle: [128, 92, 85] },
      { cx: 113.5, cy: 59.6, w: 12, h: 7, pelle: [149, 108, 92] },
    ],
  },
  woman_judge_dark: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 91 },
    occhi: [
      { cx: 77.2, cy: 59.7, w: 11, h: 7, pelle: [81, 63, 59] },
      { cx: 113.8, cy: 59.7, w: 11, h: 7, pelle: [84, 56, 53] },
    ],
  },
  man_superhero_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 77 },
    occhi: [
      { cx: 77.3, cy: 59.8, w: 11, h: 7, pelle: [228, 164, 145] },
      { cx: 113.6, cy: 59.8, w: 11, h: 7, pelle: [255, 205, 185] },
    ],
  },
  man_superhero_medium_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 77 },
    occhi: [
      { cx: 77.3, cy: 59.8, w: 11, h: 7, pelle: [215, 151, 127] },
      { cx: 113.6, cy: 59.8, w: 11, h: 7, pelle: [248, 183, 154] },
    ],
  },
  man_superhero_medium: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 77 },
    occhi: [
      { cx: 77.3, cy: 59.8, w: 11, h: 7, pelle: [155, 109, 101] },
      { cx: 113.6, cy: 59.8, w: 11, h: 7, pelle: [202, 144, 125] },
    ],
  },
  man_superhero_medium_dark: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 77 },
    occhi: [
      { cx: 77.3, cy: 59.8, w: 11, h: 7, pelle: [133, 90, 85] },
      { cx: 113.6, cy: 59.8, w: 11, h: 7, pelle: [160, 101, 95] },
    ],
  },
  man_superhero_dark: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 77 },
    occhi: [
      { cx: 77.3, cy: 59.8, w: 11, h: 7, pelle: [90, 64, 62] },
      { cx: 113.7, cy: 59.8, w: 11, h: 7, pelle: [96, 50, 54] },
    ],
  },
  woman_superhero_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 91 },
    occhi: [
      { cx: 77.5, cy: 59.5, w: 11, h: 8, pelle: [229, 172, 153] },
      { cx: 113.5, cy: 59.5, w: 11, h: 8, pelle: [255, 214, 188] },
    ],
  },
  woman_superhero_medium_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 91 },
    occhi: [
      { cx: 77.5, cy: 59.5, w: 11, h: 8, pelle: [216, 159, 134] },
      { cx: 113.5, cy: 59.5, w: 11, h: 8, pelle: [246, 192, 155] },
    ],
  },
  woman_superhero_medium: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 91 },
    occhi: [
      { cx: 77.4, cy: 59.6, w: 11, h: 8, pelle: [152, 112, 102] },
      { cx: 113.5, cy: 59.5, w: 11, h: 8, pelle: [196, 152, 124] },
    ],
  },
  woman_superhero_medium_dark: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 91 },
    occhi: [
      { cx: 77.4, cy: 59.6, w: 11, h: 8, pelle: [128, 93, 85] },
      { cx: 113.5, cy: 59.5, w: 11, h: 8, pelle: [151, 106, 91] },
    ],
  },
  woman_superhero_dark: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 91 },
    occhi: [
      { cx: 77.4, cy: 59.6, w: 11, h: 8, pelle: [82, 64, 61] },
      { cx: 113.5, cy: 59.5, w: 11, h: 8, pelle: [82, 52, 48] },
    ],
  },
  man_scientist_light: {
    testa: { alto: 12, basso: 179, cx: 92.5, w: 77 },
    occhi: [
      { cx: 74.2, cy: 120.4, w: 32, h: 32, pelle: [221, 206, 241] },
      { cx: 124, cy: 118.8, w: 46, h: 50, pelle: [231, 184, 174] },
    ],
  },
  man_scientist_medium_light: {
    testa: { alto: 12, basso: 179, cx: 92.5, w: 77 },
    occhi: [
      { cx: 74.2, cy: 120.5, w: 32, h: 30, pelle: [221, 206, 240] },
      { cx: 124.2, cy: 118.9, w: 46, h: 50, pelle: [217, 168, 152] },
    ],
  },
  man_scientist_medium: {
    testa: { alto: 12, basso: 179, cx: 92.5, w: 77 },
    occhi: [
      { cx: 74.4, cy: 120.8, w: 32, h: 29, pelle: [220, 206, 240] },
      { cx: 124.3, cy: 118.4, w: 45, h: 50, pelle: [179, 141, 133] },
    ],
  },
  man_scientist_medium_dark: {
    testa: { alto: 12, basso: 179, cx: 92.5, w: 77 },
    occhi: [
      { cx: 74.4, cy: 121, w: 32, h: 28, pelle: [220, 206, 240] },
      { cx: 124.5, cy: 118.4, w: 45, h: 50, pelle: [144, 109, 111] },
    ],
  },
  man_scientist_dark: {
    testa: { alto: 12, basso: 179, cx: 92.5, w: 77 },
    occhi: [
      { cx: 74.5, cy: 121.2, w: 32, h: 28, pelle: [220, 206, 240] },
      { cx: 124.6, cy: 118.6, w: 45, h: 50, pelle: [98, 81, 84] },
    ],
  },
  woman_scientist_light: {
    testa: { alto: 12, basso: 179, cx: 92.5, w: 91 },
    occhi: [
      { cx: 75, cy: 118.6, w: 32, h: 36, pelle: [220, 201, 243] },
      { cx: 123.6, cy: 115.8, w: 44, h: 51, pelle: [253, 205, 186] },
    ],
  },
  woman_scientist_medium_light: {
    testa: { alto: 12, basso: 179, cx: 92.5, w: 91 },
    occhi: [
      { cx: 74.8, cy: 118.5, w: 32, h: 35, pelle: [220, 201, 243] },
      { cx: 123.8, cy: 115.9, w: 44, h: 51, pelle: [231, 181, 155] },
    ],
  },
  woman_scientist_medium: {
    testa: { alto: 12, basso: 179, cx: 92.5, w: 91 },
    occhi: [
      { cx: 75.3, cy: 119.2, w: 32, h: 32, pelle: [220, 202, 243] },
      { cx: 124.1, cy: 115.7, w: 44, h: 45, pelle: [199, 154, 131] },
    ],
  },
  woman_scientist_medium_dark: {
    testa: { alto: 12, basso: 179, cx: 92.5, w: 91 },
    occhi: [
      { cx: 75.3, cy: 119.2, w: 32, h: 32, pelle: [220, 202, 243] },
      { cx: 124.4, cy: 115.9, w: 44, h: 44, pelle: [153, 113, 101] },
    ],
  },
  woman_scientist_dark: {
    testa: { alto: 12, basso: 179, cx: 92.5, w: 91 },
    occhi: [
      { cx: 75.4, cy: 119.4, w: 32, h: 32, pelle: [220, 201, 243] },
      { cx: 124.5, cy: 115.9, w: 43, h: 44, pelle: [88, 61, 59] },
    ],
  },
  man_teacher_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 169 },
    occhi: [
      { cx: 77.7, cy: 59.3, w: 12, h: 8, pelle: [85, 63, 84] },
      { cx: 113.3, cy: 59.3, w: 12, h: 8, pelle: [105, 82, 102] },
    ],
  },
  man_teacher_medium_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 169 },
    occhi: [
      { cx: 77.7, cy: 59.3, w: 12, h: 8, pelle: [84, 61, 85] },
      { cx: 113.6, cy: 59.5, w: 11, h: 8, pelle: [59, 42, 73] },
    ],
  },
  man_teacher_medium: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 169 },
    occhi: [
      { cx: 77.7, cy: 59.3, w: 12, h: 8, pelle: [67, 48, 83] },
      { cx: 113.2, cy: 59.2, w: 12, h: 8, pelle: [71, 51, 73] },
    ],
  },
  man_teacher_medium_dark: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 169 },
    occhi: [
      { cx: 77.6, cy: 59.4, w: 12, h: 8, pelle: [69, 49, 78] },
      { cx: 113.3, cy: 59.3, w: 12, h: 8, pelle: [84, 62, 89] },
    ],
  },
  man_teacher_dark: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 169 },
    occhi: [
      { cx: 77.2, cy: 59.7, w: 11, h: 7, pelle: [75, 59, 85] },
      { cx: 113.9, cy: 59.7, w: 11, h: 7, pelle: [51, 34, 59] },
    ],
  },
  woman_teacher_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 169 },
    occhi: [
      { cx: 77.7, cy: 59.4, w: 12, h: 8, pelle: [72, 52, 77] },
      { cx: 113.3, cy: 59.4, w: 12, h: 8, pelle: [79, 61, 86] },
    ],
  },
  woman_teacher_medium_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 169 },
    occhi: [
      { cx: 77.6, cy: 59.5, w: 12, h: 8, pelle: [168, 122, 111] },
      { cx: 113.3, cy: 59.4, w: 12, h: 8, pelle: [79, 59, 87] },
    ],
  },
  woman_teacher_medium: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 169 },
    occhi: [
      { cx: 77.5, cy: 59.6, w: 12, h: 7, pelle: [92, 67, 81] },
      { cx: 113.4, cy: 59.5, w: 12, h: 8, pelle: [161, 125, 113] },
    ],
  },
  woman_teacher_medium_dark: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 169 },
    occhi: [
      { cx: 77.2, cy: 59.7, w: 11, h: 7, pelle: [67, 50, 83] },
      { cx: 113.7, cy: 59.7, w: 13, h: 7, pelle: [144, 104, 90] },
    ],
  },
  woman_teacher_dark: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 169 },
    occhi: [
      { cx: 77.2, cy: 59.7, w: 11, h: 7, pelle: [64, 50, 78] },
      { cx: 113.8, cy: 59.7, w: 11, h: 7, pelle: [61, 46, 76] },
    ],
  },
  man_student_light: {
    testa: { alto: 12, basso: 179, cx: 97.5, w: 111 },
    occhi: [
      { cx: 77.2, cy: 59.3, w: 11, h: 8, pelle: [231, 172, 149] },
      { cx: 114, cy: 59.4, w: 10, h: 8, pelle: [255, 214, 186] },
    ],
  },
  man_student_medium_light: {
    testa: { alto: 12, basso: 179, cx: 97.5, w: 111 },
    occhi: [
      { cx: 77.2, cy: 59.3, w: 11, h: 8, pelle: [215, 157, 129] },
      { cx: 114, cy: 59.4, w: 10, h: 8, pelle: [244, 191, 153] },
    ],
  },
  man_student_medium: {
    testa: { alto: 12, basso: 179, cx: 97.5, w: 111 },
    occhi: [
      { cx: 77.1, cy: 59.3, w: 12, h: 8, pelle: [152, 114, 101] },
      { cx: 113.8, cy: 59.3, w: 11, h: 8, pelle: [194, 150, 123] },
    ],
  },
  man_student_medium_dark: {
    testa: { alto: 12, basso: 179, cx: 97.5, w: 111 },
    occhi: [
      { cx: 77.2, cy: 59.3, w: 11, h: 8, pelle: [128, 93, 85] },
      { cx: 113.9, cy: 59.4, w: 12, h: 8, pelle: [150, 107, 92] },
    ],
  },
  man_student_dark: {
    testa: { alto: 12, basso: 179, cx: 97.5, w: 111 },
    occhi: [
      { cx: 77, cy: 59.4, w: 10, h: 8, pelle: [79, 60, 56] },
      { cx: 114, cy: 59.4, w: 10, h: 8, pelle: [83, 54, 51] },
    ],
  },
  woman_student_light: {
    testa: { alto: 12, basso: 179, cx: 97.5, w: 111 },
    occhi: [
      { cx: 76.9, cy: 62.7, w: 9, h: 8, pelle: [228, 171, 151] },
      { cx: 114, cy: 62.6, w: 9, h: 8, pelle: [255, 215, 188] },
    ],
  },
  woman_student_medium_light: {
    testa: { alto: 12, basso: 179, cx: 97.5, w: 111 },
    occhi: [
      { cx: 76.9, cy: 62.7, w: 9, h: 8, pelle: [215, 157, 131] },
      { cx: 114, cy: 62.6, w: 9, h: 8, pelle: [246, 193, 156] },
    ],
  },
  woman_student_medium: {
    testa: { alto: 12, basso: 179, cx: 97.5, w: 111 },
    occhi: [
      { cx: 76.9, cy: 62.7, w: 9, h: 8, pelle: [151, 111, 100] },
      { cx: 114, cy: 62.6, w: 9, h: 8, pelle: [197, 152, 126] },
    ],
  },
  woman_student_medium_dark: {
    testa: { alto: 12, basso: 179, cx: 97.5, w: 111 },
    occhi: [
      { cx: 76.8, cy: 62.9, w: 8, h: 8, pelle: [123, 86, 81] },
      { cx: 114, cy: 62.6, w: 9, h: 8, pelle: [152, 108, 93] },
    ],
  },
  woman_student_dark: {
    testa: { alto: 12, basso: 179, cx: 97.5, w: 111 },
    occhi: [
      { cx: 76.8, cy: 62.9, w: 8, h: 8, pelle: [74, 55, 52] },
      { cx: 114.2, cy: 62.8, w: 9, h: 8, pelle: [83, 54, 50] },
    ],
  },
  man_technologist_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 77 },
    occhi: [
      { cx: 77.7, cy: 59.3, w: 12, h: 8, pelle: [226, 170, 144] },
      { cx: 113.5, cy: 59.5, w: 12, h: 8, pelle: [255, 214, 184] },
    ],
  },
  man_technologist_medium_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 77 },
    occhi: [
      { cx: 77.6, cy: 59.4, w: 12, h: 8, pelle: [210, 154, 124] },
      { cx: 113.8, cy: 59.6, w: 11, h: 8, pelle: [244, 193, 152] },
    ],
  },
  man_technologist_medium: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 77 },
    occhi: [
      { cx: 77.7, cy: 59.3, w: 12, h: 8, pelle: [147, 112, 97] },
      { cx: 113.3, cy: 59.3, w: 12, h: 8, pelle: [191, 151, 123] },
    ],
  },
  man_technologist_medium_dark: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 77 },
    occhi: [
      { cx: 77.6, cy: 59.4, w: 12, h: 8, pelle: [123, 91, 83] },
      { cx: 113.4, cy: 59.4, w: 13, h: 8, pelle: [150, 110, 94] },
    ],
  },
  man_technologist_dark: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 77 },
    occhi: [
      { cx: 77.2, cy: 59.7, w: 11, h: 7, pelle: [82, 64, 60] },
      { cx: 113.8, cy: 59.6, w: 11, h: 8, pelle: [85, 59, 55] },
    ],
  },
  woman_technologist_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 91 },
    occhi: [
      { cx: 77.7, cy: 59.4, w: 12, h: 8, pelle: [229, 173, 148] },
      { cx: 113.3, cy: 59.4, w: 12, h: 8, pelle: [255, 215, 185] },
    ],
  },
  woman_technologist_medium_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 91 },
    occhi: [
      { cx: 77.6, cy: 59.5, w: 12, h: 8, pelle: [211, 156, 126] },
      { cx: 113.3, cy: 59.4, w: 12, h: 8, pelle: [244, 193, 152] },
    ],
  },
  woman_technologist_medium: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 91 },
    occhi: [
      { cx: 77.5, cy: 59.6, w: 12, h: 7, pelle: [146, 111, 95] },
      { cx: 113.4, cy: 59.5, w: 12, h: 8, pelle: [191, 150, 121] },
    ],
  },
  woman_technologist_medium_dark: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 91 },
    occhi: [
      { cx: 77.2, cy: 59.7, w: 11, h: 7, pelle: [124, 91, 82] },
      { cx: 113.7, cy: 59.7, w: 13, h: 7, pelle: [143, 103, 86] },
    ],
  },
  woman_technologist_dark: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 91 },
    occhi: [
      { cx: 77.2, cy: 59.7, w: 11, h: 7, pelle: [81, 63, 59] },
      { cx: 113.8, cy: 59.7, w: 11, h: 7, pelle: [85, 57, 53] },
    ],
  },
  man_artist_light: {
    testa: { alto: 12, basso: 179, cx: 93, w: 84 },
    occhi: [
      { cx: 77.7, cy: 59.3, w: 12, h: 8, pelle: [179, 137, 124] },
      { cx: 113.5, cy: 59.5, w: 12, h: 8, pelle: [255, 215, 187] },
    ],
  },
  man_artist_medium_light: {
    testa: { alto: 12, basso: 179, cx: 93, w: 84 },
    occhi: [
      { cx: 77.7, cy: 59.3, w: 12, h: 8, pelle: [166, 123, 105] },
      { cx: 113.8, cy: 59.6, w: 11, h: 8, pelle: [246, 193, 155] },
    ],
  },
  man_artist_medium: {
    testa: { alto: 12, basso: 179, cx: 93, w: 84 },
    occhi: [
      { cx: 77.7, cy: 59.3, w: 12, h: 8, pelle: [124, 94, 87] },
      { cx: 113.3, cy: 59.3, w: 12, h: 8, pelle: [194, 152, 126] },
    ],
  },
  man_artist_medium_dark: {
    testa: { alto: 12, basso: 179, cx: 93, w: 84 },
    occhi: [
      { cx: 77.6, cy: 59.4, w: 12, h: 8, pelle: [100, 73, 70] },
      { cx: 113.3, cy: 59.3, w: 12, h: 8, pelle: [152, 110, 95] },
    ],
  },
  man_artist_dark: {
    testa: { alto: 12, basso: 179, cx: 93, w: 84 },
    occhi: [
      { cx: 77.2, cy: 59.7, w: 11, h: 7, pelle: [59, 46, 46] },
      { cx: 113.8, cy: 59.6, w: 11, h: 8, pelle: [84, 56, 54] },
    ],
  },
  woman_artist_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 91 },
    occhi: [
      { cx: 77.6, cy: 59.5, w: 12, h: 8, pelle: [232, 173, 151] },
      { cx: 113.3, cy: 59.4, w: 12, h: 8, pelle: [255, 215, 187] },
    ],
  },
  woman_artist_medium_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 91 },
    occhi: [
      { cx: 77.6, cy: 59.5, w: 12, h: 8, pelle: [218, 159, 132] },
      { cx: 113.4, cy: 59.4, w: 12, h: 8, pelle: [243, 191, 154] },
    ],
  },
  woman_artist_medium: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 91 },
    occhi: [
      { cx: 77.5, cy: 59.6, w: 12, h: 7, pelle: [153, 113, 101] },
      { cx: 113.4, cy: 59.5, w: 12, h: 8, pelle: [193, 151, 124] },
    ],
  },
  woman_artist_medium_dark: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 91 },
    occhi: [
      { cx: 77.2, cy: 59.7, w: 11, h: 7, pelle: [128, 92, 85] },
      { cx: 113.7, cy: 59.7, w: 13, h: 7, pelle: [147, 106, 90] },
    ],
  },
  woman_artist_dark: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 91 },
    occhi: [
      { cx: 77.2, cy: 59.7, w: 11, h: 7, pelle: [82, 64, 59] },
      { cx: 113.8, cy: 59.7, w: 11, h: 7, pelle: [84, 56, 53] },
    ],
  },
  man_singer_light: {
    testa: { alto: 19, basso: 172, cx: 90.5, w: 79 },
    occhi: [
      { cx: 71.5, cy: 68.2, w: 11, h: 8, pelle: [234, 146, 137] },
      { cx: 109.5, cy: 68.1, w: 12, h: 8, pelle: [255, 215, 188] },
    ],
  },
  man_singer_medium_light: {
    testa: { alto: 19, basso: 172, cx: 90.5, w: 79 },
    occhi: [
      { cx: 71.5, cy: 68.2, w: 11, h: 8, pelle: [224, 134, 123] },
      { cx: 109.5, cy: 68.1, w: 12, h: 8, pelle: [246, 192, 156] },
    ],
  },
  man_singer_medium: {
    testa: { alto: 19, basso: 172, cx: 90.5, w: 79 },
    occhi: [
      { cx: 71.5, cy: 68.2, w: 11, h: 8, pelle: [170, 100, 99] },
      { cx: 109.5, cy: 68.1, w: 12, h: 8, pelle: [194, 152, 126] },
    ],
  },
  man_singer_medium_dark: {
    testa: { alto: 19, basso: 172, cx: 90.5, w: 79 },
    occhi: [
      { cx: 71.5, cy: 68.2, w: 11, h: 8, pelle: [155, 85, 89] },
      { cx: 109.6, cy: 68.1, w: 12, h: 8, pelle: [152, 109, 95] },
    ],
  },
  man_singer_dark: {
    testa: { alto: 19, basso: 172, cx: 90.5, w: 79 },
    occhi: [
      { cx: 71.5, cy: 68.2, w: 11, h: 8, pelle: [121, 63, 69] },
      { cx: 109.5, cy: 68.1, w: 12, h: 8, pelle: [86, 60, 57] },
    ],
  },
  woman_singer_light: {
    testa: { alto: 19, basso: 172, cx: 90.5, w: 93 },
    occhi: [
      { cx: 71.7, cy: 68.1, w: 12, h: 8, pelle: [227, 169, 151] },
      { cx: 109.5, cy: 68.1, w: 12, h: 8, pelle: [255, 214, 188] },
    ],
  },
  woman_singer_medium_light: {
    testa: { alto: 19, basso: 172, cx: 90.5, w: 93 },
    occhi: [
      { cx: 71.7, cy: 68.1, w: 12, h: 8, pelle: [213, 155, 131] },
      { cx: 109.5, cy: 68.1, w: 12, h: 8, pelle: [245, 191, 155] },
    ],
  },
  woman_singer_medium: {
    testa: { alto: 19, basso: 172, cx: 90.5, w: 93 },
    occhi: [
      { cx: 71.7, cy: 68.1, w: 12, h: 8, pelle: [154, 113, 101] },
      { cx: 109.5, cy: 68.1, w: 12, h: 8, pelle: [194, 150, 125] },
    ],
  },
  woman_singer_medium_dark: {
    testa: { alto: 19, basso: 172, cx: 90.5, w: 93 },
    occhi: [
      { cx: 71.7, cy: 68.1, w: 12, h: 8, pelle: [128, 91, 85] },
      { cx: 109.5, cy: 68.1, w: 12, h: 8, pelle: [151, 107, 93] },
    ],
  },
  woman_singer_dark: {
    testa: { alto: 19, basso: 172, cx: 90.5, w: 93 },
    occhi: [
      { cx: 71.7, cy: 68.1, w: 12, h: 8, pelle: [80, 61, 59] },
      { cx: 109.5, cy: 68.1, w: 12, h: 8, pelle: [84, 57, 55] },
    ],
  },
  man_guard_light: { testa: { alto: 12, basso: 179, cx: 95.5, w: 81 }, occhi: null },
  man_guard_medium_light: { testa: { alto: 12, basso: 179, cx: 95.5, w: 81 }, occhi: null },
  man_guard_medium: { testa: { alto: 12, basso: 179, cx: 95.5, w: 81 }, occhi: null },
  man_guard_medium_dark: { testa: { alto: 12, basso: 179, cx: 95.5, w: 81 }, occhi: null },
  man_guard_dark: { testa: { alto: 12, basso: 179, cx: 95.5, w: 81 }, occhi: null },
  woman_guard_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 89 },
    occhi: [
      { cx: 76.1, cy: 89.3, w: 9, h: 8, pelle: [216, 183, 211] },
      { cx: 114.9, cy: 89.3, w: 9, h: 8, pelle: [232, 207, 232] },
    ],
  },
  woman_guard_medium_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 89 },
    occhi: [
      { cx: 76.2, cy: 89.2, w: 9, h: 8, pelle: [212, 160, 160] },
      { cx: 114.8, cy: 89.2, w: 9, h: 8, pelle: [219, 171, 164] },
    ],
  },
  woman_guard_medium: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 89 },
    occhi: [
      { cx: 76.1, cy: 89.3, w: 9, h: 8, pelle: [194, 166, 207] },
      { cx: 114.9, cy: 89.3, w: 9, h: 8, pelle: [222, 199, 230] },
    ],
  },
  woman_guard_medium_dark: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 89 },
    occhi: [
      { cx: 76.2, cy: 89.2, w: 9, h: 8, pelle: [148, 114, 130] },
      { cx: 114.9, cy: 89.3, w: 9, h: 8, pelle: [217, 195, 228] },
    ],
  },
  woman_guard_dark: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 89 },
    occhi: [
      { cx: 76.5, cy: 88.7, w: 8, h: 7, pelle: [75, 54, 57] },
      { cx: 114.5, cy: 88.7, w: 8, h: 7, pelle: [74, 48, 48] },
    ],
  },
  man_detective_light: {
    testa: { alto: 12, basso: 179, cx: 100, w: 140 },
    occhi: [
      { cx: 81, cy: 133, w: 11, h: 10, pelle: [106, 89, 131] },
      { cx: 99.4, cy: 130.8, w: 14, h: 14, pelle: [93, 73, 116] },
    ],
  },
  man_detective_medium_light: {
    testa: { alto: 12, basso: 179, cx: 100, w: 140 },
    occhi: [
      { cx: 80.9, cy: 133.1, w: 11, h: 9, pelle: [104, 87, 128] },
      { cx: 99.2, cy: 131.1, w: 13, h: 13, pelle: [91, 71, 113] },
    ],
  },
  man_detective_medium: {
    testa: { alto: 12, basso: 179, cx: 100, w: 140 },
    occhi: [
      { cx: 80.7, cy: 133.1, w: 10, h: 10, pelle: [103, 87, 130] },
      { cx: 99.7, cy: 131.3, w: 11, h: 13, pelle: [89, 69, 111] },
    ],
  },
  man_detective_medium_dark: {
    testa: { alto: 12, basso: 179, cx: 100, w: 140 },
    occhi: [
      { cx: 80.7, cy: 133.2, w: 9, h: 9, pelle: [108, 92, 129] },
      { cx: 99.7, cy: 131.5, w: 11, h: 12, pelle: [87, 68, 110] },
    ],
  },
  man_detective_dark: {
    testa: { alto: 12, basso: 179, cx: 100, w: 140 },
    occhi: [
      { cx: 80.7, cy: 133.8, w: 10, h: 9, pelle: [100, 86, 127] },
      { cx: 99.5, cy: 131.8, w: 12, h: 12, pelle: [88, 70, 112] },
    ],
  },
  woman_detective_light: {
    testa: { alto: 12, basso: 179, cx: 100, w: 140 },
    occhi: [
      { cx: 80.4, cy: 131.5, w: 13, h: 14, pelle: [103, 87, 135] },
      { cx: 101.3, cy: 126.7, w: 19, h: 24, pelle: [92, 71, 117] },
    ],
  },
  woman_detective_medium_light: {
    testa: { alto: 12, basso: 179, cx: 100, w: 140 },
    occhi: [
      { cx: 80.5, cy: 131.4, w: 13, h: 14, pelle: [103, 87, 134] },
      { cx: 101.4, cy: 126.7, w: 18, h: 25, pelle: [91, 70, 116] },
    ],
  },
  woman_detective_medium: {
    testa: { alto: 12, basso: 179, cx: 100, w: 140 },
    occhi: [
      { cx: 80.3, cy: 131.5, w: 12, h: 14, pelle: [103, 87, 134] },
      { cx: 101.2, cy: 127.6, w: 16, h: 22, pelle: [91, 71, 117] },
    ],
  },
  woman_detective_medium_dark: {
    testa: { alto: 12, basso: 179, cx: 100, w: 140 },
    occhi: [
      { cx: 80.3, cy: 131.8, w: 12, h: 14, pelle: [102, 87, 134] },
      { cx: 100.9, cy: 128.1, w: 15, h: 21, pelle: [92, 73, 117] },
    ],
  },
  woman_detective_dark: {
    testa: { alto: 12, basso: 179, cx: 100, w: 140 },
    occhi: [
      { cx: 80.6, cy: 131.9, w: 13, h: 13, pelle: [101, 87, 133] },
      { cx: 100.5, cy: 128.5, w: 17, h: 21, pelle: [90, 71, 117] },
    ],
  },
  man_wearing_turban_light: {
    testa: { alto: 11, basso: 179, cx: 96.5, w: 141 },
    occhi: [
      { cx: 81.8, cy: 18.8, w: 14, h: 15, pelle: [195, 192, 199] },
      { cx: 97.5, cy: 26.8, w: 26, h: 32, pelle: [206, 183, 216] },
    ],
  },
  man_wearing_turban_medium_light: {
    testa: { alto: 11, basso: 179, cx: 96.5, w: 141 },
    occhi: [
      { cx: 81.8, cy: 18.8, w: 14, h: 15, pelle: [195, 192, 199] },
      { cx: 97.5, cy: 26.8, w: 26, h: 32, pelle: [203, 179, 213] },
    ],
  },
  man_wearing_turban_medium: {
    testa: { alto: 11, basso: 179, cx: 96.5, w: 141 },
    occhi: [
      { cx: 81.8, cy: 18.8, w: 14, h: 15, pelle: [195, 192, 199] },
      { cx: 97.5, cy: 26.8, w: 26, h: 32, pelle: [197, 176, 212] },
    ],
  },
  man_wearing_turban_medium_dark: {
    testa: { alto: 11, basso: 179, cx: 96.5, w: 141 },
    occhi: [
      { cx: 81.8, cy: 18.8, w: 14, h: 15, pelle: [195, 192, 199] },
      { cx: 97.5, cy: 26.7, w: 26, h: 32, pelle: [194, 173, 211] },
    ],
  },
  man_wearing_turban_dark: {
    testa: { alto: 11, basso: 179, cx: 96.5, w: 141 },
    occhi: [
      { cx: 81.7, cy: 18.9, w: 14, h: 15, pelle: [195, 191, 199] },
      { cx: 97.6, cy: 26.7, w: 25, h: 32, pelle: [207, 193, 221] },
    ],
  },
  woman_wearing_turban_light: {
    testa: { alto: 11, basso: 179, cx: 96.5, w: 141 },
    occhi: [
      { cx: 81.7, cy: 18.9, w: 14, h: 15, pelle: [196, 192, 199] },
      { cx: 97.4, cy: 26.8, w: 27, h: 32, pelle: [208, 185, 217] },
    ],
  },
  woman_wearing_turban_medium_light: {
    testa: { alto: 11, basso: 179, cx: 96.5, w: 141 },
    occhi: [
      { cx: 81.8, cy: 18.9, w: 14, h: 15, pelle: [196, 192, 199] },
      { cx: 97.5, cy: 26.8, w: 26, h: 32, pelle: [206, 183, 215] },
    ],
  },
  woman_wearing_turban_medium: {
    testa: { alto: 11, basso: 179, cx: 96.5, w: 141 },
    occhi: [
      { cx: 81.8, cy: 18.9, w: 14, h: 15, pelle: [195, 192, 199] },
      { cx: 97.5, cy: 26.7, w: 26, h: 32, pelle: [200, 179, 214] },
    ],
  },
  woman_wearing_turban_medium_dark: {
    testa: { alto: 11, basso: 179, cx: 96.5, w: 141 },
    occhi: [
      { cx: 81.8, cy: 18.9, w: 14, h: 15, pelle: [195, 192, 199] },
      { cx: 97.5, cy: 26.7, w: 26, h: 32, pelle: [196, 176, 213] },
    ],
  },
  woman_wearing_turban_dark: {
    testa: { alto: 11, basso: 179, cx: 96.5, w: 141 },
    occhi: [
      { cx: 81.8, cy: 18.9, w: 14, h: 15, pelle: [195, 191, 199] },
      { cx: 97.6, cy: 26.6, w: 25, h: 32, pelle: [209, 195, 223] },
    ],
  },
  man_supervillain_light: { testa: { alto: 12, basso: 179, cx: 96, w: 90 }, occhi: null },
  man_supervillain_medium_light: { testa: { alto: 12, basso: 179, cx: 96, w: 90 }, occhi: null },
  man_supervillain_medium: { testa: { alto: 12, basso: 179, cx: 96, w: 90 }, occhi: null },
  man_supervillain_medium_dark: { testa: { alto: 12, basso: 179, cx: 96, w: 90 }, occhi: null },
  man_supervillain_dark: { testa: { alto: 12, basso: 179, cx: 96, w: 90 }, occhi: null },
  woman_supervillain_light: { testa: { alto: 12, basso: 179, cx: 95.5, w: 91 }, occhi: null },
  woman_supervillain_medium_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 91 },
    occhi: null,
  },
  woman_supervillain_medium: { testa: { alto: 12, basso: 179, cx: 95.5, w: 91 }, occhi: null },
  woman_supervillain_medium_dark: { testa: { alto: 12, basso: 179, cx: 95.5, w: 91 }, occhi: null },
  woman_supervillain_dark: { testa: { alto: 12, basso: 179, cx: 95.5, w: 91 }, occhi: null },
  man_mage_light: {
    testa: { alto: 12, basso: 179, cx: 98, w: 148 },
    occhi: [
      { cx: 76.8, cy: 86.3, w: 12, h: 8, pelle: [182, 180, 204] },
      { cx: 113.9, cy: 86.3, w: 11, h: 8, pelle: [227, 223, 240] },
    ],
  },
  man_mage_medium_light: {
    testa: { alto: 12, basso: 179, cx: 98, w: 148 },
    occhi: [
      { cx: 77.1, cy: 86.3, w: 11, h: 8, pelle: [186, 183, 206] },
      { cx: 113.9, cy: 86.3, w: 11, h: 8, pelle: [226, 222, 239] },
    ],
  },
  man_mage_medium: {
    testa: { alto: 12, basso: 179, cx: 98, w: 148 },
    occhi: [
      { cx: 77, cy: 86.2, w: 11, h: 8, pelle: [184, 182, 205] },
      { cx: 114.2, cy: 86.3, w: 12, h: 8, pelle: [219, 216, 234] },
    ],
  },
  man_mage_medium_dark: {
    testa: { alto: 12, basso: 179, cx: 98, w: 148 },
    occhi: [
      { cx: 77.1, cy: 86.3, w: 11, h: 8, pelle: [185, 183, 206] },
      { cx: 113.9, cy: 86.3, w: 11, h: 8, pelle: [223, 220, 238] },
    ],
  },
  man_mage_dark: {
    testa: { alto: 12, basso: 179, cx: 98, w: 148 },
    occhi: [
      { cx: 77.2, cy: 86.1, w: 11, h: 8, pelle: [183, 182, 205] },
      { cx: 113.8, cy: 86.1, w: 11, h: 8, pelle: [222, 219, 237] },
    ],
  },
  woman_mage_light: {
    testa: { alto: 12, basso: 179, cx: 98, w: 148 },
    occhi: [
      { cx: 77.1, cy: 92.4, w: 10, h: 8, pelle: [218, 165, 153] },
      { cx: 113.9, cy: 92.4, w: 10, h: 8, pelle: [239, 191, 173] },
    ],
  },
  woman_mage_medium_light: {
    testa: { alto: 12, basso: 179, cx: 98, w: 148 },
    occhi: [
      { cx: 77.1, cy: 92.4, w: 10, h: 8, pelle: [205, 150, 132] },
      { cx: 113.9, cy: 92.4, w: 10, h: 8, pelle: [221, 171, 144] },
    ],
  },
  woman_mage_medium: {
    testa: { alto: 12, basso: 179, cx: 98, w: 148 },
    occhi: [
      { cx: 76.9, cy: 92.5, w: 11, h: 8, pelle: [144, 106, 105] },
      { cx: 114, cy: 92.5, w: 11, h: 8, pelle: [173, 132, 115] },
    ],
  },
  woman_mage_medium_dark: {
    testa: { alto: 12, basso: 179, cx: 98, w: 148 },
    occhi: [
      { cx: 77.1, cy: 92.5, w: 10, h: 8, pelle: [121, 85, 84] },
      { cx: 113.9, cy: 92.4, w: 10, h: 8, pelle: [136, 95, 86] },
    ],
  },
  woman_mage_dark: {
    testa: { alto: 12, basso: 179, cx: 98, w: 148 },
    occhi: [
      { cx: 77.1, cy: 92.5, w: 10, h: 8, pelle: [75, 57, 57] },
      { cx: 114, cy: 92.5, w: 10, h: 8, pelle: [73, 49, 49] },
    ],
  },
  man_fairy_light: {
    testa: { alto: 13, basso: 178, cx: 97, w: 108 },
    occhi: [
      { cx: 74.3, cy: 50, w: 27, h: 28, pelle: [0, 0, 0] },
      { cx: 124.8, cy: 50, w: 26, h: 28, pelle: [0, 0, 0] },
    ],
  },
  man_fairy_medium_light: {
    testa: { alto: 13, basso: 178, cx: 97, w: 108 },
    occhi: [
      { cx: 74.3, cy: 50, w: 27, h: 28, pelle: [0, 0, 0] },
      { cx: 124.8, cy: 50, w: 26, h: 28, pelle: [0, 0, 0] },
    ],
  },
  man_fairy_medium: {
    testa: { alto: 13, basso: 178, cx: 97, w: 108 },
    occhi: [
      { cx: 74.3, cy: 50, w: 27, h: 28, pelle: [0, 0, 0] },
      { cx: 124.9, cy: 50, w: 26, h: 28, pelle: [0, 0, 0] },
    ],
  },
  man_fairy_medium_dark: {
    testa: { alto: 13, basso: 178, cx: 97, w: 108 },
    occhi: [
      { cx: 74.3, cy: 50, w: 27, h: 28, pelle: [0, 0, 0] },
      { cx: 124.9, cy: 50, w: 26, h: 28, pelle: [0, 0, 0] },
    ],
  },
  man_fairy_dark: {
    testa: { alto: 13, basso: 178, cx: 97, w: 108 },
    occhi: [
      { cx: 74.3, cy: 50, w: 27, h: 28, pelle: [0, 0, 0] },
      { cx: 124.9, cy: 50, w: 26, h: 28, pelle: [0, 0, 0] },
    ],
  },
  woman_fairy_light: {
    testa: { alto: 13, basso: 178, cx: 97, w: 108 },
    occhi: [
      { cx: 71.1, cy: 46.6, w: 17, h: 21, pelle: [0, 0, 0] },
      { cx: 128, cy: 46.7, w: 17, h: 21, pelle: [255, 214, 190] },
    ],
  },
  woman_fairy_medium_light: {
    testa: { alto: 13, basso: 178, cx: 97, w: 108 },
    occhi: [
      { cx: 71.1, cy: 46.6, w: 17, h: 21, pelle: [0, 0, 0] },
      { cx: 128, cy: 46.7, w: 17, h: 21, pelle: [243, 193, 160] },
    ],
  },
  woman_fairy_medium: {
    testa: { alto: 13, basso: 178, cx: 97, w: 108 },
    occhi: [
      { cx: 71.1, cy: 46.6, w: 17, h: 21, pelle: [0, 0, 0] },
      { cx: 128, cy: 46.7, w: 17, h: 21, pelle: [197, 155, 132] },
    ],
  },
  woman_fairy_medium_dark: {
    testa: { alto: 13, basso: 178, cx: 97, w: 108 },
    occhi: [
      { cx: 71.1, cy: 46.6, w: 17, h: 21, pelle: [0, 0, 0] },
      { cx: 128, cy: 46.7, w: 17, h: 21, pelle: [155, 114, 102] },
    ],
  },
  woman_fairy_dark: {
    testa: { alto: 13, basso: 178, cx: 97, w: 108 },
    occhi: [
      { cx: 71.1, cy: 46.6, w: 17, h: 21, pelle: [0, 0, 0] },
      { cx: 128, cy: 46.7, w: 17, h: 21, pelle: [92, 68, 66] },
    ],
  },
  man_vampire_light: {
    testa: { alto: 12, basso: 179, cx: 96, w: 130 },
    occhi: [
      { cx: 80.2, cy: 112, w: 9, h: 7, pelle: [81, 59, 99] },
      { cx: 110.2, cy: 108.8, w: 12, h: 17, pelle: [90, 71, 109] },
    ],
  },
  man_vampire_medium_light: {
    testa: { alto: 12, basso: 179, cx: 96, w: 130 },
    occhi: [
      { cx: 79.9, cy: 112.3, w: 8, h: 7, pelle: [81, 59, 99] },
      { cx: 110.4, cy: 109, w: 11, h: 16, pelle: [90, 70, 109] },
    ],
  },
  man_vampire_medium: {
    testa: { alto: 12, basso: 179, cx: 96, w: 130 },
    occhi: [
      { cx: 76.6, cy: 59.6, w: 10, h: 8, pelle: [153, 113, 102] },
      { cx: 114.3, cy: 59.6, w: 9, h: 8, pelle: [198, 153, 127] },
    ],
  },
  man_vampire_medium_dark: {
    testa: { alto: 12, basso: 179, cx: 96, w: 130 },
    occhi: [
      { cx: 76.2, cy: 60, w: 7, h: 7, pelle: [123, 86, 80] },
      { cx: 114.4, cy: 59.6, w: 10, h: 8, pelle: [153, 109, 94] },
    ],
  },
  man_vampire_dark: {
    testa: { alto: 12, basso: 179, cx: 96, w: 130 },
    occhi: [
      { cx: 76.3, cy: 60, w: 7, h: 7, pelle: [73, 55, 52] },
      { cx: 114.8, cy: 60, w: 7, h: 7, pelle: [83, 53, 50] },
    ],
  },
  woman_vampire_light: {
    testa: { alto: 13, basso: 179, cx: 96, w: 130 },
    occhi: [
      { cx: 76.3, cy: 60, w: 7, h: 7, pelle: [226, 170, 150] },
      { cx: 114.8, cy: 60, w: 7, h: 7, pelle: [255, 217, 190] },
    ],
  },
  woman_vampire_medium_light: {
    testa: { alto: 13, basso: 179, cx: 96, w: 130 },
    occhi: [
      { cx: 76.3, cy: 60, w: 7, h: 7, pelle: [211, 155, 129] },
      { cx: 114.8, cy: 60, w: 7, h: 7, pelle: [247, 194, 157] },
    ],
  },
  woman_vampire_medium: {
    testa: { alto: 13, basso: 179, cx: 96, w: 130 },
    occhi: [
      { cx: 76.3, cy: 60, w: 7, h: 7, pelle: [149, 109, 99] },
      { cx: 114.8, cy: 60, w: 7, h: 7, pelle: [198, 153, 127] },
    ],
  },
  woman_vampire_medium_dark: {
    testa: { alto: 13, basso: 179, cx: 96, w: 130 },
    occhi: [
      { cx: 76.3, cy: 60, w: 7, h: 7, pelle: [123, 85, 80] },
      { cx: 115, cy: 60.1, w: 8, h: 7, pelle: [153, 108, 93] },
    ],
  },
  woman_vampire_dark: {
    testa: { alto: 13, basso: 179, cx: 96, w: 130 },
    occhi: [
      { cx: 76.5, cy: 59.9, w: 8, h: 7, pelle: [73, 55, 52] },
      { cx: 114.8, cy: 60, w: 7, h: 7, pelle: [83, 53, 50] },
    ],
  },
  man_elf_light: {
    testa: { alto: 13, basso: 179, cx: 96, w: 110 },
    occhi: [
      { cx: 77.7, cy: 59.3, w: 12, h: 8, pelle: [229, 171, 149] },
      { cx: 113.5, cy: 59.5, w: 12, h: 8, pelle: [255, 216, 188] },
    ],
  },
  man_elf_medium_light: {
    testa: { alto: 13, basso: 179, cx: 96, w: 110 },
    occhi: [
      { cx: 77.7, cy: 59.3, w: 12, h: 8, pelle: [214, 156, 129] },
      { cx: 113.8, cy: 59.6, w: 11, h: 8, pelle: [247, 194, 156] },
    ],
  },
  man_elf_medium: {
    testa: { alto: 13, basso: 179, cx: 96, w: 110 },
    occhi: [
      { cx: 77.7, cy: 59.3, w: 12, h: 8, pelle: [152, 113, 101] },
      { cx: 113.3, cy: 59.3, w: 12, h: 8, pelle: [194, 152, 125] },
    ],
  },
  man_elf_medium_dark: {
    testa: { alto: 13, basso: 179, cx: 96, w: 110 },
    occhi: [
      { cx: 77.6, cy: 59.4, w: 12, h: 8, pelle: [127, 92, 85] },
      { cx: 113.4, cy: 59.4, w: 13, h: 8, pelle: [151, 109, 94] },
    ],
  },
  man_elf_dark: {
    testa: { alto: 13, basso: 179, cx: 96, w: 110 },
    occhi: [
      { cx: 77.2, cy: 59.7, w: 11, h: 7, pelle: [82, 64, 60] },
      { cx: 113.8, cy: 59.6, w: 11, h: 8, pelle: [85, 56, 54] },
    ],
  },
  woman_elf_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 99 },
    occhi: [
      { cx: 77.5, cy: 59.6, w: 12, h: 7, pelle: [231, 173, 151] },
      { cx: 113.4, cy: 59.5, w: 12, h: 8, pelle: [255, 216, 187] },
    ],
  },
  woman_elf_medium_light: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 99 },
    occhi: [
      { cx: 77.5, cy: 59.6, w: 12, h: 7, pelle: [217, 158, 131] },
      { cx: 113.4, cy: 59.5, w: 12, h: 8, pelle: [246, 192, 155] },
    ],
  },
  woman_elf_medium: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 99 },
    occhi: [
      { cx: 77.5, cy: 59.6, w: 12, h: 7, pelle: [151, 112, 99] },
      { cx: 113.5, cy: 59.6, w: 12, h: 7, pelle: [195, 152, 125] },
    ],
  },
  woman_elf_medium_dark: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 99 },
    occhi: [
      { cx: 77.2, cy: 59.7, w: 11, h: 7, pelle: [127, 91, 84] },
      { cx: 113.5, cy: 59.6, w: 12, h: 7, pelle: [151, 108, 93] },
    ],
  },
  woman_elf_dark: {
    testa: { alto: 12, basso: 179, cx: 95.5, w: 99 },
    occhi: [
      { cx: 77.2, cy: 59.7, w: 11, h: 7, pelle: [81, 63, 58] },
      { cx: 113.8, cy: 59.7, w: 11, h: 7, pelle: [84, 56, 53] },
    ],
  },
  man_tipping_hand_light: {
    testa: { alto: 11, basso: 179, cx: 72.1, w: 97.7 },
    occhi: [
      { cx: 48.8, cy: 72.2, w: 15, h: 10, pelle: [234, 176, 153] },
      { cx: 95.3, cy: 72.2, w: 15, h: 10, pelle: [255, 214, 186] },
    ],
  },
  man_tipping_hand_medium_light: {
    testa: { alto: 11, basso: 179, cx: 72, w: 97.2 },
    occhi: [
      { cx: 48.9, cy: 72, w: 15, h: 10, pelle: [219, 161, 134] },
      { cx: 95, cy: 71.9, w: 14, h: 10, pelle: [247, 193, 154] },
    ],
  },
  man_tipping_hand_medium: {
    testa: { alto: 11, basso: 179, cx: 72.1, w: 97.4 },
    occhi: [
      { cx: 48.8, cy: 72.1, w: 15, h: 11, pelle: [155, 117, 103] },
      { cx: 95.3, cy: 72.1, w: 15, h: 11, pelle: [191, 149, 123] },
    ],
  },
  man_tipping_hand_medium_dark: {
    testa: { alto: 11, basso: 179, cx: 72.1, w: 97.6 },
    occhi: [
      { cx: 48.8, cy: 72.1, w: 15, h: 10, pelle: [130, 96, 89] },
      { cx: 95.3, cy: 72.2, w: 15, h: 10, pelle: [148, 107, 92] },
    ],
  },
  man_tipping_hand_dark: {
    testa: { alto: 11, basso: 179, cx: 72, w: 97.1 },
    occhi: [
      { cx: 48.9, cy: 72, w: 15, h: 10, pelle: [84, 67, 64] },
      { cx: 95.1, cy: 72, w: 15, h: 10, pelle: [82, 54, 50] },
    ],
  },
  woman_tipping_hand_light: {
    testa: { alto: 4, basso: 179, cx: 72.2, w: 121.6 },
    occhi: [
      { cx: 48.9, cy: 73.5, w: 15, h: 11, pelle: [234, 176, 153] },
      { cx: 95.5, cy: 73.7, w: 15, h: 11, pelle: [255, 212, 184] },
    ],
  },
  woman_tipping_hand_medium_light: {
    testa: { alto: 5, basso: 179, cx: 72.2, w: 120.2 },
    occhi: [
      { cx: 49, cy: 73.3, w: 15, h: 10, pelle: [221, 162, 135] },
      { cx: 95.3, cy: 73.3, w: 15, h: 10, pelle: [247, 190, 152] },
    ],
  },
  woman_tipping_hand_medium: {
    testa: { alto: 6, basso: 179, cx: 72.4, w: 119.3 },
    occhi: [
      { cx: 49.4, cy: 73.6, w: 17, h: 11, pelle: [154, 114, 100] },
      { cx: 95.3, cy: 73.6, w: 15, h: 11, pelle: [192, 148, 121] },
    ],
  },
  woman_tipping_hand_medium_dark: {
    testa: { alto: 4, basso: 179, cx: 72.2, w: 121.9 },
    occhi: [
      { cx: 48.8, cy: 73.5, w: 15, h: 11, pelle: [130, 94, 86] },
      { cx: 95.6, cy: 73.8, w: 16, h: 11, pelle: [145, 103, 89] },
    ],
  },
  woman_tipping_hand_dark: {
    testa: { alto: 5, basso: 179, cx: 72.1, w: 120.3 },
    occhi: [
      { cx: 48.8, cy: 73.4, w: 15, h: 10, pelle: [84, 65, 61] },
      { cx: 95.3, cy: 73.3, w: 15, h: 10, pelle: [81, 53, 49] },
    ],
  },
  man_raising_hand_light: {
    testa: { alto: 25, basso: 179, cx: 116.4, w: 88.7 },
    occhi: [
      { cx: 95.3, cy: 80.7, w: 15, h: 9, pelle: [195, 149, 136] },
      { cx: 137.5, cy: 80.7, w: 14, h: 9, pelle: [255, 217, 188] },
    ],
  },
  man_raising_hand_medium_light: {
    testa: { alto: 25, basso: 179, cx: 116.5, w: 88.7 },
    occhi: [
      { cx: 95.4, cy: 80.6, w: 14, h: 9, pelle: [182, 133, 117] },
      { cx: 137.5, cy: 80.7, w: 14, h: 9, pelle: [247, 194, 155] },
    ],
  },
  man_raising_hand_medium: {
    testa: { alto: 25, basso: 179, cx: 116.3, w: 88.8 },
    occhi: [
      { cx: 95.1, cy: 80.9, w: 15, h: 10, pelle: [123, 94, 95] },
      { cx: 137.5, cy: 80.6, w: 14, h: 9, pelle: [196, 153, 126] },
    ],
  },
  man_raising_hand_medium_dark: {
    testa: { alto: 25, basso: 179, cx: 116.5, w: 88.5 },
    occhi: [
      { cx: 95.4, cy: 80.6, w: 14, h: 9, pelle: [99, 70, 79] },
      { cx: 137.6, cy: 80.9, w: 14, h: 10, pelle: [152, 110, 95] },
    ],
  },
  man_raising_hand_dark: {
    testa: { alto: 25, basso: 179, cx: 116.4, w: 88.9 },
    occhi: [
      { cx: 95.2, cy: 80.7, w: 13, h: 9, pelle: [53, 42, 53] },
      { cx: 137.5, cy: 80.7, w: 14, h: 9, pelle: [84, 56, 54] },
    ],
  },
  woman_raising_hand_light: {
    testa: { alto: 15, basso: 179, cx: 116.4, w: 115.8 },
    occhi: [
      { cx: 94.2, cy: 81, w: 13, h: 9, pelle: [203, 151, 137] },
      { cx: 138.6, cy: 81, w: 13, h: 9, pelle: [255, 214, 187] },
    ],
  },
  woman_raising_hand_medium_light: {
    testa: { alto: 15, basso: 179, cx: 116.4, w: 115.2 },
    occhi: [
      { cx: 94.2, cy: 81, w: 13, h: 9, pelle: [191, 135, 118] },
      { cx: 138.6, cy: 81, w: 13, h: 9, pelle: [244, 192, 155] },
    ],
  },
  woman_raising_hand_medium: {
    testa: { alto: 15, basso: 179, cx: 116.4, w: 115.4 },
    occhi: [
      { cx: 94.2, cy: 81, w: 13, h: 9, pelle: [135, 95, 93] },
      { cx: 138.6, cy: 81, w: 13, h: 9, pelle: [195, 152, 125] },
    ],
  },
  woman_raising_hand_medium_dark: {
    testa: { alto: 15, basso: 179, cx: 116.4, w: 115.6 },
    occhi: [
      { cx: 94.2, cy: 81, w: 13, h: 9, pelle: [107, 70, 74] },
      { cx: 138.6, cy: 81, w: 13, h: 9, pelle: [152, 109, 94] },
    ],
  },
  woman_raising_hand_dark: {
    testa: { alto: 16, basso: 179, cx: 116.3, w: 115.1 },
    occhi: [
      { cx: 94, cy: 81, w: 12, h: 9, pelle: [63, 42, 49] },
      { cx: 138.5, cy: 80.9, w: 13, h: 9, pelle: [85, 57, 54] },
    ],
  },
  pregnant_woman_light: {
    testa: { alto: 12, basso: 179, cx: 107.5, w: 79 },
    occhi: [
      { cx: 91.6, cy: 52.8, w: 9, h: 7, pelle: [237, 181, 159] },
      { cx: 123.4, cy: 52.8, w: 9, h: 7, pelle: [255, 213, 187] },
    ],
  },
  pregnant_woman_medium_light: {
    testa: { alto: 12, basso: 179, cx: 107.5, w: 79 },
    occhi: [
      { cx: 91.6, cy: 52.8, w: 9, h: 7, pelle: [223, 165, 138] },
      { cx: 123.4, cy: 52.8, w: 9, h: 7, pelle: [243, 192, 155] },
    ],
  },
  pregnant_woman_medium: {
    testa: { alto: 12, basso: 179, cx: 107.5, w: 79 },
    occhi: [
      { cx: 91.3, cy: 53, w: 10, h: 7, pelle: [158, 118, 104] },
      { cx: 123.4, cy: 52.8, w: 9, h: 7, pelle: [196, 152, 126] },
    ],
  },
  pregnant_woman_medium_dark: {
    testa: { alto: 12, basso: 179, cx: 107.5, w: 79 },
    occhi: [
      { cx: 91.6, cy: 52.7, w: 9, h: 7, pelle: [131, 95, 87] },
      { cx: 123.5, cy: 52.8, w: 10, h: 7, pelle: [150, 107, 93] },
    ],
  },
  pregnant_woman_dark: {
    testa: { alto: 12, basso: 179, cx: 107.5, w: 79 },
    occhi: [
      { cx: 91.6, cy: 52.7, w: 9, h: 7, pelle: [83, 64, 61] },
      { cx: 123.4, cy: 52.9, w: 9, h: 7, pelle: [84, 56, 53] },
    ],
  },
};
