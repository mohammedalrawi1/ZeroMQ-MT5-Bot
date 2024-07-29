class InputField {
  constructor({
    name,
    label,
    parent,
    options,
    tail,
    boxSize,
    withTypes,
    insertBeforeElement,
    typesName,
    typeValue,
  }) {
    this.name = name;
    this.label = label;
    this.parent = parent;
    this.options = options;
    this.tail = tail;
    this.boxSize = boxSize;
    this.withTypes = withTypes;
    this.insertBeforeElement = insertBeforeElement;
    this.typesName = typesName;
    this.typeValue = typeValue;

    return this.build();
  }

  build() {
    this.container = this.parent.createE(
      "div",
      `input-container ${this.withTypes ? "with-type" : ""}`,
      {
        id: `${this.name}-input`,
        insertBeforeElement: this.insertBeforeElement,
      }
    );

    if (this.options.type == "select") {
      this.input = this.container.createE("select", "input", {
        ...this.options,
        name: this.name,
      });
    } else {
      this.input = this.container.createE("input", "input", {
        ...this.options,
        name: this.name,
      });
    }

    if (this.withTypes) {
      this.type = this.container.createE("select", "input", {
        name: this.typesName || `${this.name}Type`,
        values: this.withTypes,
        value: this.typeValue,
        style: {
          marginLeft: "10px",
        },
      });
    }

    this.label = this.container.createE("label", "label", this.label, {
      for: this.name,
    });
    return this.container;
  }

  remove() {
    this.container.remove();
  }
}
