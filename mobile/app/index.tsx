import { ScrollView, View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, StatCard, StatusChip, MenuTile, CartLine, text, color, space } from "@/design";

// Design-system preview / app shell. The real first slice — Floor + Register
// (blueprint §5) — is the next pass; this screen proves the §4 vocabulary renders
// natively and the dark theme + Poppins are wired.
export default function Home() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={text.display}>Surge POS</Text>
        <Text style={[text.bodyDim, { marginBottom: space.xl }]}>
          Native iOS shell — design-system preview. Floor + Register are the next slice.
        </Text>

        <View style={styles.row}>
          <StatCard label="Sales today" value="$0.00" />
          <StatCard label="Open checks" value="0" />
        </View>

        <Text style={[text.heading, styles.section]}>Status</Text>
        <View style={styles.wrap}>
          <StatusChip status="available" label="Open" />
          <StatusChip status="occupied" label="Seated" />
          <StatusChip status="warning" label="60m" />
          <StatusChip status="late" label="Late 90m+" />
          <StatusChip status="paid" label="Paid" />
        </View>

        <Text style={[text.heading, styles.section]}>Menu</Text>
        <View style={styles.tiles}>
          <MenuTile name="Cheeseburger" price="$14.00" />
          <MenuTile name="Fries" price="$6.00" />
          <MenuTile name="Cola" price="$3.50" />
        </View>

        <Text style={[text.heading, styles.section]}>Check</Text>
        <View>
          <CartLine name="Cheeseburger" qty={1} price="$14.00" note="no onion" />
          <CartLine name="Fries" qty={2} price="$12.00" />
        </View>

        <View style={styles.actions}>
          <Button title="Charge $26.00" onPress={() => {}} />
          <Button title="Add item" variant="secondary" onPress={() => {}} />
          <Button title="Void" variant="danger" onPress={() => {}} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },
  content: { padding: space.xl, gap: space.sm },
  row: { flexDirection: "row", gap: space.md },
  section: { marginTop: space.xl, marginBottom: space.sm },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  tiles: { flexDirection: "row", gap: space.md },
  actions: { marginTop: space.xl, gap: space.md },
});
